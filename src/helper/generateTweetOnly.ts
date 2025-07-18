

import express, { Request, Response } from 'express';
import { OpenAI } from 'openai';

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// ========================= TYPES & INTERFACES =========================

interface TweetOnlyRequest {
  session_id: string;
  raw_thoughts: string;
  previous_content?: string[];
  pipeline_type: string; // "simple" or "meme"
}

interface SessionData {
  session_id: string;
  created_at: string;
  pipeline_type?: string;
  meme_style?: string;
  final_tweet?: string;
  tweet_metadata?: any;
  meme_template_data?: any;
  cloudinary_urls: string[];
  token_usage: {
    total_tokens: number;
    character_generation_tokens: number;
    action_generation_tokens: number;
    image_generations: any[];
  };
}

interface TweetFeatures {
  primary_emotion: string;
  content_type: string;
  key_concepts: string[];
  conflict_elements: string[];
  humor_type: string;
  requires_visual_elements: string[];
  meme_potential_keywords: string[];
}

interface MemeTemplate {
  name: string;
  description: string;
  use_case: string;
  keywords: string[];
  emotional_triggers: string[];
  visual_structure: string;
  layout_requirements: string;
  template_format: string;
  ideal_for: string;
  meme_strength: number;
}

interface TemplateCompatibility {
  template_name: string;
  compatibility_score: number;
  reasons: string[];
  template_data: MemeTemplate;
}

interface TweetVariation {
  content: string;
  approach: string;
  viral_elements: string[];
  engagement_prediction: string;
  target_emotion: string;
  character_count: number;
  error?: string;
}

interface APIResponse {
  success: boolean;
  message: string;
  data?: any;
  session_id?: string;
}

// ========================= CONSTANTS =========================

const ENHANCED_MEME_TEMPLATES: MemeTemplate[] = [
  {
    name: "Drake Hotline Bling",
    description: "Two-panel vertical layout: top panel rejection, bottom panel approval",
    use_case: "comparing options, preferences, choices, before/after",
    keywords: ["choice", "preference", "compare", "vs", "better", "worse", "reject", "accept", "old", "new"],
    emotional_triggers: ["decision", "upgrade", "improvement", "selection"],
    visual_structure: "Two vertical panels with same character in different poses",
    layout_requirements: "TOP: Drake pointing away with rejecting expression, BOTTOM: Drake pointing toward with approving smile",
    template_format: "comparison_vertical",
    ideal_for: "contrasting options, rejection vs approval, this vs that",
    meme_strength: 95
  },
  {
    name: "Distracted Boyfriend",
    description: "Man turning from girlfriend to check out another woman",
    use_case: "distraction, temptation, shifting attention, betrayal, choosing between options",
    keywords: ["temptation", "distraction", "new", "old", "choice", "betrayal", "switching", "leaving"],
    emotional_triggers: ["temptation", "curiosity", "desire", "conflict"],
    visual_structure: "Single panel showing three people in triangle formation",
    layout_requirements: "Man turning from girlfriend toward other woman, girlfriend looking disapproving",
    template_format: "triangle_relationship",
    ideal_for: "distraction, temptation, shifting attention, betrayal, choosing between options",
    meme_strength: 98
  },
  {
    name: "Surprised Pikachu",
    description: "Pikachu with wide-eyed shocked expression",
    use_case: "mock surprise, predictable outcomes, feigned shock, obvious results",
    keywords: ["surprise", "shock", "obvious", "predictable", "expected", "wow", "really"],
    emotional_triggers: ["surprise", "sarcasm", "mockery", "obviousness"],
    visual_structure: "Single panel close-up of Pikachu's face",
    layout_requirements: "Pikachu with wide eyes and open mouth showing exaggerated surprise",
    template_format: "single_reaction",
    ideal_for: "mock surprise, predictable outcomes, feigned shock, obvious results",
    meme_strength: 92
  },
  {
    name: "Woman Yelling at Cat",
    description: "Split image of yelling woman and confused cat at dinner table",
    use_case: "arguments, confusion, misunderstanding, confrontation, talking past each other",
    keywords: ["argument", "confusion", "misunderstanding", "fight", "confrontation", "different views"],
    emotional_triggers: ["anger", "confusion", "frustration", "confrontation"],
    visual_structure: "Two panels showing woman and cat in confrontational setup",
    layout_requirements: "LEFT: woman pointing and yelling, RIGHT: confused cat at table with food",
    template_format: "split_confrontation",
    ideal_for: "arguments, confusion, misunderstanding, confrontation, talking past each other",
    meme_strength: 94
  },
  {
    name: "This Is Fine",
    description: "Dog sitting in burning room saying everything is fine",
    use_case: "denial, ignoring problems, everything falling apart, false optimism",
    keywords: ["fine", "okay", "disaster", "burning", "denial", "ignoring", "problems"],
    emotional_triggers: ["denial", "anxiety", "false comfort", "disaster"],
    visual_structure: "Single panel showing dog in burning room",
    layout_requirements: "Dog calmly sitting with coffee in chaotic burning environment",
    template_format: "single_denial",
    ideal_for: "denial, ignoring problems, everything falling apart, false optimism",
    meme_strength: 96
  },
  {
    name: "Always Has Been",
    description: "Two astronauts with plot twist revelation, second about to shoot first",
    use_case: "plot twists, revelations, always been true, shocking discoveries",
    keywords: ["always", "truth", "revelation", "discovery", "plot twist", "reality", "shocking"],
    emotional_triggers: ["revelation", "shock", "realization", "truth"],
    visual_structure: "Two panels showing astronauts in space",
    layout_requirements: "Panel 1: astronaut realizing truth, Panel 2: second astronaut with gun saying 'always has been'",
    template_format: "revelation_sequence",
    ideal_for: "plot twists, revelations, always been true, shocking discoveries",
    meme_strength: 93
  }
];

// ========================= GLOBAL VARIABLES =========================

const activeSessions: Record<string, TweetGenerator> = {};
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configure Cloudinary
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET
// });

// ========================= MEME TEMPLATE ANALYZER =========================

class MemeTemplateAnalyzer {
  private client: OpenAI;

  constructor(openaiClient: OpenAI) {
    this.client = openaiClient;
  }

  /**
   * Extract semantic features from tweet for template matching
   */
  async extractTweetFeatures(tweet: string): Promise<TweetFeatures> {
    try {
      const prompt = `Analyze this tweet and extract key features for meme template matching:

TWEET: "${tweet}"

Extract and return JSON with:
- primary_emotion: main emotion conveyed
- content_type: type of content (complaint, comparison, observation, etc.)
- key_concepts: list of main concepts/themes
- conflict_elements: any conflicting elements or tensions
- humor_type: type of humor (sarcasm, irony, observational, etc.)
- requires_visual_elements: what visual elements would enhance this
- meme_potential_keywords: keywords that suggest meme template types`;

      const response = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert in meme analysis and social media content structure. Analyze content for meme template matching. Return only valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.1
      });

      let responseText = response.choices[0].message.content?.trim() || '';

      const jsonMatch = responseText.match(/```json\s*(\{.*?\})\s*```/s);

      if (jsonMatch) {
        responseText = jsonMatch[1];
      }

      responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const extractedFeatures = JSON.parse(responseText);

      // Validate and ensure all required fields exist
      const defaultFeatures: TweetFeatures = {
        primary_emotion: "neutral",
        content_type: "observation",
        key_concepts: [],
        conflict_elements: [],
        humor_type: "observational",
        requires_visual_elements: [],
        meme_potential_keywords: []
      };

      // Merge with defaults
      for (const [key, defaultValue] of Object.entries(defaultFeatures)) {
        if (!(key in extractedFeatures)) {
          extractedFeatures[key] = defaultValue;
        } else if (typeof extractedFeatures[key] !== typeof defaultValue) {
          if (Array.isArray(defaultValue)) {
            extractedFeatures[key] = extractedFeatures[key] ? [String(extractedFeatures[key])] : [];
          } else {
            extractedFeatures[key] = extractedFeatures[key] ? String(extractedFeatures[key]) : defaultValue;
          }
        }
      }

      return extractedFeatures;
    } catch (error) {
      console.error('Tweet feature extraction failed:', error);
      return {
        primary_emotion: "neutral",
        content_type: "observation",
        key_concepts: [],
        conflict_elements: [],
        humor_type: "observational",
        requires_visual_elements: [],
        meme_potential_keywords: []
      };
    }
  }

  /**
   * Calculate compatibility score between tweet features and meme template
   */
  calculateTemplateCompatibility(tweetFeatures: TweetFeatures, template: MemeTemplate): TemplateCompatibility {
    let compatibilityScore = 0;
    const reasons: string[] = [];

    // Check keyword matches
    const tweetKeywords = new Set(tweetFeatures.meme_potential_keywords);
    const templateKeywords = new Set(template.keywords);
    const keywordOverlap = new Set([...tweetKeywords].filter(x => templateKeywords.has(x)));
    const keywordScore = (keywordOverlap.size / Math.max(template.keywords.length, 1)) * 30;
    compatibilityScore += keywordScore;

    if (keywordOverlap.size > 0) {
      reasons.push(`Keyword matches: ${Array.from(keywordOverlap)}`);
    }

    // Check emotional triggers
    const tweetEmotion = tweetFeatures.primary_emotion.toLowerCase();
    const templateEmotions = template.emotional_triggers.map(e => e.toLowerCase());
    if (templateEmotions.includes(tweetEmotion)) {
      compatibilityScore += 25;
      reasons.push(`Emotional match: ${tweetEmotion}`);
    }

    // Check content type alignment
    const contentType = tweetFeatures.content_type.toLowerCase();
    const useCase = template.use_case.toLowerCase();
    if (contentType.split(' ').some(ct => useCase.includes(ct))) {
      compatibilityScore += 20;
      reasons.push(`Content type alignment: ${contentType}`);
    }

    // Check humor type compatibility
    const humorType = tweetFeatures.humor_type.toLowerCase();
    if (template.use_case.toLowerCase().includes(humorType)) {
      compatibilityScore += 15;
      reasons.push(`Humor type match: ${humorType}`);
    }

    // Bonus for high-strength templates
    const strengthBonus = (template.meme_strength / 100) * 10;
    compatibilityScore += strengthBonus;

    return {
      template_name: template.name,
      compatibility_score: Math.min(compatibilityScore, 100),
      reasons,
      template_data: template
    };
  }

  /**
   * Find the best matching meme template using advanced analysis
   */
  async findBestMemeTemplate(tweet: string) {
    try {
      // Extract tweet features
      const tweetFeatures = await this.extractTweetFeatures(tweet);
      console.log('Tweet features extracted:', tweetFeatures);

      // Calculate compatibility for each template
      const templateScores: TemplateCompatibility[] = [];
      for (const template of ENHANCED_MEME_TEMPLATES) {
        const scoreData = this.calculateTemplateCompatibility(tweetFeatures, template);
        templateScores.push(scoreData);
        console.log(`Template ${template.name}: ${scoreData.compatibility_score.toFixed(1)}`);
      }

      // Sort by compatibility score
      templateScores.sort((a, b) => b.compatibility_score - a.compatibility_score);

      // Get top 3 candidates
      const topCandidates = templateScores.slice(0, 3);

      // Use GPT to make final selection among top candidates
      const finalSelection = await this.makeFinalTemplateSelection(tweet, tweetFeatures, topCandidates);

      return {
        best_match: finalSelection,
        tweet_features: tweetFeatures,
        all_scores: templateScores,
        top_candidates: topCandidates
      };
    } catch (error) {
      console.error('Meme template matching failed:', error);
      return this.getFallbackTemplate(tweet);
    }
  }

  /**
   * Use GPT to make final selection among top candidates
   */
  async makeFinalTemplateSelection(tweet: string, tweetFeatures: TweetFeatures, topCandidates: TemplateCompatibility[]) {
    try {
      const prompt = `Select the BEST meme template for this tweet from the top candidates:

TWEET: "${tweet}"
TWEET FEATURES: ${JSON.stringify(tweetFeatures, null, 2)}

TOP CANDIDATES:
${JSON.stringify(topCandidates, null, 2)}

Consider:
1. Which template structure best fits the tweet's message
2. Which would create the most engaging visual
3. Which template format suits the content type
4. Which has the highest viral potential

Return JSON with:
- selected_template: name of chosen template
- confidence_score: 0-100 confidence in selection
- visual_adaptation: how the tweet should be adapted to this template
- why_selected: detailed reasoning for selection`;

      const response = await this.client.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [
          {
            role: "system",
            content: "You are an expert meme creator who understands viral content patterns and visual storytelling. Return only valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      });

      let responseText = response.choices[0].message.content?.trim() || '';
      const jsonMatch = responseText.match(/```json\s*(\{.*?\})\s*```/s);
      if (jsonMatch) {
        responseText = jsonMatch[1];
      }

      responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const selectionData = JSON.parse(responseText);

      // Validate selection_data structure
      if (typeof selectionData !== 'object' || !selectionData.selected_template) {
        throw new Error('Invalid selection data format');
      }

      // Ensure required fields exist
      const requiredFields = {
        selected_template: '',
        confidence_score: 75,
        visual_adaptation: 'Generated fallback',
        why_selected: 'Generated fallback'
      };

      for (const [field, defaultValue] of Object.entries(requiredFields)) {
        if (!(field in selectionData)) {
          selectionData[field] = defaultValue;
        }
      }

      // Find the selected template data
      const selectedName = selectionData.selected_template;
      const selectedCandidate = topCandidates.find(c => c.template_name === selectedName) || topCandidates[0];

      return {
        template_name: selectedCandidate.template_name,
        template_data: selectedCandidate.template_data,
        compatibility_score: selectedCandidate.compatibility_score,
        confidence_score: selectionData.confidence_score || 80,
        visual_adaptation: selectionData.visual_adaptation || '',
        why_selected: selectionData.why_selected || 'Best match based on content analysis',
        reasons: selectedCandidate.reasons
      };
    } catch (error) {
      console.error('Final template selection failed:', error);
      return topCandidates[0] || this.getFallbackTemplate(tweet).best_match;
    }
  }

  /**
   * Get fallback template when analysis fails
   */
  getFallbackTemplate(tweet: string) {
    const fallback = {
      template_name: "Drake Hotline Bling",
      template_data: ENHANCED_MEME_TEMPLATES[0],
      compatibility_score: 70,
      confidence_score: 60,
      visual_adaptation: "Use as comparison template",
      why_selected: "Fallback - versatile template suitable for most content",
      reasons: ["Fallback selection"]
    };

    return {
      best_match: fallback,
      tweet_features: {},
      all_scores: [],
      top_candidates: [fallback]
    };
  }
}

// ========================= TWEET GENERATOR =========================

class TweetGenerator {
  private sessionId: string;
  private client: OpenAI;
  private sessionData: SessionData;
  private memeAnalyzer: MemeTemplateAnalyzer;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.memeAnalyzer = new MemeTemplateAnalyzer(this.client);

    // Initialize session data
    this.sessionData = {
      session_id: sessionId,
      created_at: new Date().toISOString(),
      pipeline_type: undefined,
      meme_style: undefined,
      final_tweet: undefined,
      tweet_metadata: undefined,
      meme_template_data: undefined,
      cloudinary_urls: [],
      token_usage: {
        total_tokens: 0,
        character_generation_tokens: 0,
        action_generation_tokens: 0,
        image_generations: []
      }
    };
  }

  /**
   * Identify the primary niche for the tweet content
   */
  private async detectNiche(tweet: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert content analyzer. Identify the main niche/topic of the given content. Return only one word — the best-matching PRIMARY niche like: technology, finance, health, fitness, travel, food, lifestyle, entertainment, education, work, relationships, business, sports, gaming, art, music, etc."
          },
          {
            role: "user",
            content: tweet.slice(0, 2000)
          }
        ],
        max_tokens: 10,
        temperature: 0.1
      });

      let niche = response.choices[0].message.content?.trim().toLowerCase() || 'lifestyle';
      niche = niche.replace(/[^\w\s]/g, '');
      niche = niche.split(' ')[0] || 'lifestyle';
      return niche;
    } catch (error) {
      console.error('Niche detection failed:', error);
      return 'lifestyle';
    }
  }

  /**
   * Fetch top hashtags for the identified niche
   */
  private async fetchTopHashtags(niche: string, count: number = 10): Promise<string[]> {
    const url = `https://best-hashtags.com/hashtag/${niche.toLowerCase()}/`;
    const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; HashtagScraper/1.0)' };

    try {
      const response = await axios.get(url, { headers, timeout: 10000 });
      const $ = cheerio.load(response.data);

      const hashtags: string[] = [];
      const popularDiv = $('#popular');
      if (popularDiv.length === 0) return [];

      const table = popularDiv.find('table.table');
      if (table.length === 0) return [];

      table.find('tbody tr').slice(0, count).each((_, row) => {
        const cols = $(row).find('td');
        if (cols.length >= 3) {
          const hashtag = $(cols[1]).text().trim();
          hashtags.push(hashtag);
        }
      });

      return hashtags;
    } catch (error) {
      console.error('Hashtag fetching failed:', error);
      return [];
    }
  }

  /**
   * Get optimal posting times for the niche
   */
  private async getBestPostTimes(niche: string, platform: string = 'Twitter', timezoneStr: string = 'Asia/Kolkata'): Promise<string[]> {
    try {
      const now = new Date();
      const formattedTime = now.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: timezoneStr
      });

      const prompt = `As of now (${formattedTime}, ${timezoneStr}), suggest the next 3 best times to post on ${platform} for the '${niche}' niche to get maximum engagement or go viral. Only include times that are upcoming (i.e., later today or this week). Respond with only the times in short bullet point format, no extra text or intro, try to use minimum text.`;

      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a social media growth strategist and twitter/x expert." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 100
      });

      const raw = response.choices[0].message.content?.trim() || '';
      const times = raw.split('\n')
        .map(line => line.replace(/^[•-]\s*/, '').trim())
        .filter(line => line.length > 0)
        .slice(0, 3);

      return times;
    } catch (error) {
      console.error('Post times fetching failed:', error);
      return [];
    }
  }

  /**
   * Extract SEO-friendly keywords from tweet
   */
  private async extractSeoKeywords(tweet: string, count: number = 10): Promise<string[]> {
    try {
      const prompt = `From the following tweet, extract ${count} SEO-friendly keywords that could be useful for search optimization. Focus on meaningful words like nouns, adjectives, and relevant verbs. Ignore common stop words. Return only the keywords in plain text, one per line, no explanations.\n\nTweet: ${tweet}`;

      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert in SEO keyword extraction." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 150
      });

      const raw = response.choices[0].message.content?.trim() || '';
      const keywords = raw.split('\n')
        .map(line => line.replace(/^[•-]\s*/, '').trim().toLowerCase())
        .filter(line => line.length > 0);

      return keywords;
    } catch (error) {
      console.error('SEO keyword extraction failed:', error);
      return [];
    }
  }

  /**
   * Generate complete metadata for the tweet
   */
  private async generateTweetMetadata(tweet: string, platform: string = 'Twitter', timezoneStr: string = 'Asia/Kolkata'): Promise<any> {
    try {
      const niche = await this.detectNiche(tweet);
      const bestTimes = await this.getBestPostTimes(niche, platform, timezoneStr);
      const seoKeywords = await this.extractSeoKeywords(tweet, 10);
      const hashtags = await this.fetchTopHashtags(niche, 15);

      return {
        tweet,
        niche,
        optimal_posting_times: bestTimes,
        seo_keywords: seoKeywords,
        recommended_hashtags: hashtags,
        platform,
        timezone: timezoneStr,
        analysis_date: new Date().toISOString()
      };
    } catch (error) {
      console.error('Tweet metadata generation failed:', error);
      return { tweet, error: error.message };
    }
  }

  /**
   * Analyze user's writing style and voice patterns
   */
  private async analyzeStyleAndVoice(previousContent: string[]): Promise<any> {
    if (!previousContent || previousContent.length === 0) {
      return {
        voice_characteristics: {
          tone: "engaging and authentic",
          energy_level: "medium-high with enthusiasm",
          personality_traits: ["relatable", "genuine", "conversational"],
          authenticity_markers: "natural conversational flow"
        },
        engagement_patterns: {
          hook_techniques: ["strong opening statements", "relatable scenarios"],
          storytelling_style: "direct and personal",
          emotional_triggers: ["relatability", "curiosity", "inspiration"]
        },
        writing_structure: {
          sentence_patterns: "mix of short and medium sentences",
          emphasis_techniques: "strategic word choice and rhythm"
        },
        vocabulary_style: {
          formality_level: "casual but professional",
          unique_phrases: ["conversational connectors", "relatable expressions"]
        }
      };
    }

    const combinedContent = previousContent.map((content, i) => `Post ${i + 1}: ${content}`).join('\n\n');

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert social media analyst who identifies writing patterns that drive engagement while maintaining authenticity."
          },
          {
            role: "user",
            content: `Analyze these previous posts to understand their unique writing style and voice.\n\nPREVIOUS POSTS:\n${combinedContent}\n\nProvide analysis in JSON format with voice_characteristics, engagement_patterns, writing_structure, and vocabulary_style.`
          }
        ],
        max_tokens: 1500,
        temperature: 0.1
      });

      const analysisText = response.choices[0].message.content?.trim() || '';
      const jsonMatch = analysisText.match(/```json\s*(\{.*?\})\s*```/s);
      const jsonContent = jsonMatch ? jsonMatch[1] : analysisText;

      return JSON.parse(jsonContent);
    } catch (error) {
      console.error('Style analysis failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Generate a single viral variation
   */
  private async generateSingleVariation(
    approach: string,
    rawThoughts: string,
    styleAnalysis: any,
    pipelineType: string,
    memeStyle?: string
  ): Promise<TweetVariation> {
    let extraRequirements = '';
    
    if (pipelineType === 'meme') {
      let culturalContext = '';
      if (memeStyle === 'Indian') {
        culturalContext = 'Uses Indian cultural references, daily situations, and relatable Indian experiences. Incorporates popular Indian meme formats and jokes use Hindi and Hinglish but stay in the boundary of user thoughts/input and very funny and dank meme if needed.';
      } else {
        culturalContext = 'Uses global cultural references and universally relatable situations. Incorporates popular international meme formats and jokes which are famouse globally make it funny, dank joke or double meaning when needed.';
      }

      extraRequirements = `
            ✅ EXTREMELY FUNNY and MEME-WORTHY with ${memeStyle?.toLowerCase()} humor
            ${culturalContext}
            ✅ Uses relatable exaggeration typical of ${memeStyle?.toLowerCase()} memes
            ✅ Follows viral ${memeStyle?.toLowerCase()} meme best practices
            ✅ Should work perfectly with visual meme templates
            `;
    } else {
      extraRequirements = `
            ✅ Professional yet engaging tone
            ✅ Clear value proposition
            ✅ Universally relatable content
            `;
    }

    const prompt = `You are an expert viral social media copywriter. Create a ${pipelineType} tweet that is:

        ✅ Emotionally striking (humor, vulnerability, or mild controversy)
        ✅ Reads like something a real person would post
        ✅ Stays under 280 characters
        ✅ Uses simple, clear, natural language
        ✅ Safe for work and platform-compliant
        ✅ NO hashtags - only regular words
        ${extraRequirements}

        APPROACH: ${approach}
        RAW THOUGHTS: "${rawThoughts}"
        USER STYLE: ${JSON.stringify(styleAnalysis, null, 2)}

        Return JSON with: content, approach, viral_elements, engagement_prediction, target_emotion, character_count`;

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert viral ${pipelineType} content creator who creates engaging social media content.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.3
      });

      let responseText = response.choices[0].message.content?.trim() || '';
      const jsonMatch = responseText.match(/```json\s*(\{.*?\})\s*```/s);
      if (jsonMatch) {
        responseText = jsonMatch[1];
      }

      const variationData = JSON.parse(responseText);
      const content = variationData.content || '';
      variationData.character_count = content.length;

      // Ensure approach is always a string
      if (!variationData.approach || typeof variationData.approach !== 'string') {
        variationData.approach = approach;
      }

      // Validate required fields
      const requiredFields = ['content', 'approach', 'viral_elements', 'engagement_prediction', 'target_emotion'];
      for (const field of requiredFields) {
        if (!variationData[field]) {
          variationData[field] = field !== 'approach' ? `Generated ${field}` : approach;
        }
      }

      return variationData;
    } catch (error) {
      console.error(`Variation generation failed:`, error);
      return {
        content: `Error generating ${approach} variation`,
        approach,
        error: error.message,
        character_count: 0,
        viral_elements: [],
        engagement_prediction: "low",
        target_emotion: "neutral"
      };
    }
  }

  /**
   * Generate multiple viral variations using different approaches
   */
  private async generateViralVariations(
    rawThoughts: string,
    styleAnalysis: any,
    pipelineType: string,
    memeStyle?: string
  ): Promise<TweetVariation[]> {
    const approaches = [
      "Hook-driven",
      "Storytelling",
      "Controversial/Contrarian",
      "Educational/Value-packed",
      "Emotional/Relatable"
    ];

    const variations: TweetVariation[] = [];

    try {
      // Generate variations sequentially to avoid rate limiting
      for (const approach of approaches) {
        try {
          const variation = await this.generateSingleVariation(
            approach,
            rawThoughts,
            styleAnalysis,
            pipelineType,
            memeStyle
          );
          
          if (!variation.approach || typeof variation.approach !== 'string') {
            variation.approach = approach;
          }
          
          variations.push(variation);
        } catch (error) {
          console.error(`Error generating ${approach} variation:`, error);
          variations.push({
            content: `Fallback ${approach} variation`,
            approach,
            error: error.message,
            character_count: 0,
            viral_elements: [],
            engagement_prediction: "low",
            target_emotion: "neutral"
          });
        }
      }
    } catch (error) {
      console.error('Variation generation failed:', error);
      return [];
    }

    // Sort by approach order
    const approachOrder: Record<string, number> = {};
    approaches.forEach((approach, i) => {
      approachOrder[approach] = i;
    });

    try {
      variations.sort((a, b) => {
        const aOrder = approachOrder[String(a.approach)] || 999;
        const bOrder = approachOrder[String(b.approach)] || 999;
        return aOrder - bOrder;
      });
    } catch (error) {
      console.error('Sorting failed:', error);
      // Manual sorting as fallback
      const sortedVariations: TweetVariation[] = [];
      for (const approach of approaches) {
        for (const variation of variations) {
          if (String(variation.approach) === approach) {
            sortedVariations.push(variation);
            break;
          }
        }
      }
      // Add any remaining variations
      for (const variation of variations) {
        if (!sortedVariations.includes(variation)) {
          sortedVariations.push(variation);
        }
      }
      return sortedVariations;
    }

    return variations;
  }

  /**
   * Automatically select the best variation
   */
  private async selectBestVariation(rawThoughts: string, variations: TweetVariation[], styleAnalysis: any): Promise<any> {
    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert content strategist who evaluates social media content. Return only valid JSON."
          },
          {
            role: "user",
            content: `Select the best tweet variation based on authenticity, viral potential, and message alignment.\n\nORIGINAL THOUGHTS: "${rawThoughts}"\nSTYLE: ${JSON.stringify(styleAnalysis, null, 2)}\nVARIATIONS: ${JSON.stringify(variations, null, 2)}\n\nReturn JSON with best_variation containing: index, content, approach, total_score, why_selected`
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      });

      let responseText = response.choices[0].message.content?.trim() || '';
      const jsonMatch = responseText.match(/```json\s*(\{.*?\})\s*```/s);
      if (jsonMatch) {
        responseText = jsonMatch[1];
      }

      responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(responseText);

      // Validate result structure
      if (!result || typeof result !== 'object' || !result.best_variation) {
        throw new Error('Invalid result structure');
      }

      const bestVar = result.best_variation;
      if (!bestVar || typeof bestVar !== 'object') {
        throw new Error('best_variation is not a dictionary');
      }

      // Validate and set defaults for required fields
      const requiredFields = {
        index: 0,
        content: variations[0]?.content || '',
        approach: variations[0]?.approach || '',
        total_score: 75,
        why_selected: 'Fallback selection'
      };

      for (const [field, defaultValue] of Object.entries(requiredFields)) {
        if (!bestVar[field]) {
          bestVar[field] = defaultValue;
        }
      }

      return result;
    } catch (error) {
      console.error('Variation selection failed:', error);
      return {
        best_variation: {
          index: 0,
          content: variations[0]?.content || '',
          approach: variations[0]?.approach || '',
          total_score: 75,
          why_selected: 'Fallback selection'
        }
      };
    }
  }

  /**
   * Upload JSON data to Cloudinary as raw file
   */
//   private async uploadJsonToCloudinary(jsonData: any, filename: string): Promise<string | null> {
//     try {
//       const tempJsonPath = path.join(process.cwd(), `temp_${filename}.json`);
//       await fs.writeFile(tempJsonPath, JSON.stringify(jsonData, null, 2));

//       const response = await cloudinary.uploader.upload(tempJsonPath, {
//         resource_type: 'raw',
//         public_id: `${this.sessionId}_${filename}`
//       });

//       const url = response.secure_url;
//       if (url) {
//         this.sessionData.cloudinary_urls.push(url);
//         console.log(`JSON uploaded to Cloudinary: ${url}`);
//       }

//       await fs.unlink(tempJsonPath);
//       return url;
//     } catch (error) {
//       console.error('JSON upload failed:', error);
//       return null;
//     }
//   }

  /**
   * MAIN FUNCTION: Complete tweet generation workflow
   */
  async generateTweetComplete(
    rawThoughts: string,
    previousContent: string[],
    pipelineType: string,
    memeStyle?: string
  ): Promise<any> {
    try {
      console.log(`🚀 Starting tweet generation for ${pipelineType} pipeline${memeStyle ? ` (${memeStyle})` : ''}`);
      
      // Step 1: Analyze user's writing style
      console.log('📊 Analyzing writing style...');
      const styleAnalysis = await this.analyzeStyleAndVoice(previousContent);

      // Step 2: Generate multiple viral variations
      console.log('✨ Generating viral variations...');
      const variations = await this.generateViralVariations(rawThoughts, styleAnalysis, pipelineType, memeStyle);

      if (!variations || variations.length === 0) {
        return { error: 'Failed to generate variations' };
      }

      // Step 3: Select best variation
      console.log('🎯 Selecting best variation...');
      const selectionResults = await this.selectBestVariation(rawThoughts, variations, styleAnalysis);

      // Step 4: Get best tweet
      const bestTweet = selectionResults.best_variation?.content || '';
      console.log(`📝 Best tweet selected: "${bestTweet}"`);

      // Step 5: Generate comprehensive metadata
      console.log('🔍 Generating tweet metadata...');
      const tweetMetadata = await this.generateTweetMetadata(bestTweet);

      // Step 6: Find meme template if meme pipeline - ENHANCED VERSION
      let memeTemplateData = null;
      if (pipelineType === 'meme' && bestTweet) {
        console.log(`🎭 Finding meme template for: "${bestTweet}"`);
        memeTemplateData = await this.memeAnalyzer.findBestMemeTemplate(bestTweet);
        console.log(`🎨 Selected meme template: ${memeTemplateData.best_match?.template_name || 'None'}`);
      }

      // Step 7: Store in session
      this.sessionData.pipeline_type = pipelineType;
      this.sessionData.meme_style = memeStyle;
      this.sessionData.final_tweet = bestTweet;
      this.sessionData.tweet_metadata = tweetMetadata;
      this.sessionData.meme_template_data = memeTemplateData;

      console.log('✅ Tweet generation complete!');

      return {
        best_tweet: bestTweet,
        approach: selectionResults.best_variation?.approach || '',
        metadata: tweetMetadata,
        meme_template: memeTemplateData,
        variations,
        selection_reasoning: selectionResults.best_variation?.why_selected || '',
        pipeline_type: pipelineType,
        meme_style: memeStyle
      };
    } catch (error) {
      console.error('❌ Tweet generation failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Get current session data
   */
  getSessionData(): SessionData {
    return this.sessionData;
  }
}

// ========================= MAIN ENDPOINT =========================

/**
 * GENERATE TWEET ONLY ENDPOINT
 * 
 * SCOPE:
 * - Generate viral tweets with enhanced meme template matching
 * - Support for simple and meme pipelines
 * - Indian/Global meme styles
 * - Comprehensive tweet metadata (hashtags, SEO keywords, optimal posting times)
 * - Writing style analysis and adaptation
 * - Multiple variation generation and intelligent selection
 * - Cloudinary integration for data storage
 * - No character or image generation
 * 
 * WORKFLOW:
 * 1. Validate session and inputs
 * 2. Analyze user's writing style from previous content
 * 3. Generate 5 viral variations (Hook-driven, Storytelling, Controversial, Educational, Emotional)
 * 4. Automatically select best variation using AI
 * 5. Generate comprehensive metadata (niche, hashtags, SEO keywords, posting times)
 * 6. Find best meme template (if meme pipeline)
 * 7. Store session data and return results
 */
export const generateTweetOnly = async (session_id, raw_thoughts, previous_content, pipeline_type): Promise<any>=> {
  try {
    // const { session_id, raw_thoughts, previous_content, pipeline_type }: TweetOnlyRequest = req.body;

    console.log(`📨 Tweet generation request received for session: ${session_id}`);

    // Validate required fields
    // if (!session_id || !raw_thoughts || !pipeline_type) {
    //   res.status(400).json({
    //     success: false,
    //     message: 'Missing required fields: session_id, raw_thoughts, pipeline_type'
    //   });
    //   return;
    // }

    // Validate pipeline type
    // if (!['simple', 'meme'].includes(pipeline_type)) {
    //   res.status(400).json({
    //     success: false,
    //     message: "Pipeline type must be 'simple' or 'meme'"
    //   });
    //   return;
    // }

    // Get or create session
    let generator: TweetGenerator;
    if (session_id in activeSessions) {
      generator = activeSessions[session_id];
      console.log(`♻️ Using existing session: ${session_id}`);
    } else {
      generator = new TweetGenerator(session_id);
      activeSessions[session_id] = generator;
      console.log(`🆕 Created new session: ${session_id}`);
    }

    // Get meme style from session data (if available)
    const memeStyle = generator.getSessionData().meme_style;

    // Generate tweet
    console.log(`🎯 Generating ${pipeline_type} tweet${memeStyle ? ` (${memeStyle} style)` : ''}...`);
    const result = await generator.generateTweetComplete(
      raw_thoughts,
      previous_content || [],
      pipeline_type,
      memeStyle
    );

    if (result.error) {
    //   console.error(`❌ Tweet generation failed: ${result.error}`);
    //   res.status(500).json({
    //     success: false,
    //     message: result.error
    //   });
      return `Tweet generation failed: ${result.error}`
    }

    // Save session data to Cloudinary
    // console.log('☁️ Uploading session data to Cloudinary...');
    // const jsonUrl = await generator.uploadJsonToCloudinary(generator.getSessionData(), 'tweet_session');

    // Prepare response
    const responseData = {
      // Core tweet data
      tweet: result.best_tweet,
      approach: result.approach,
      character_count: result.best_tweet.length,
      
      // Pipeline info
      pipeline_type: result.pipeline_type,
      meme_style: result.meme_style,
      
      // Metadata
      metadata: result.metadata,
      
      // Meme template (if applicable)
      meme_template: result.meme_template,
      
      // All variations generated
      variations: result.variations,
      
      // Selection reasoning
      selection_reasoning: result.selection_reasoning,
      
      // Session data
      // session_data_url: jsonUrl,
      // cloudinary_urls: generator.getSessionData().cloudinary_urls,
      token_usage: generator.getSessionData().token_usage,
      
      // Timestamps
      generated_at: new Date().toISOString(),
      session_created_at: generator.getSessionData().created_at
    };

    console.log('✅ Tweet generation successful!');
    console.log(`📊 Generated tweet: "${result.best_tweet}"`);
    console.log(`🎭 Template: ${result.meme_template?.best_match?.template_name || 'None'}`);
    console.log(`📈 Approach: ${result.approach}`);

    // res.json({
    //   success: true,
    //   message: 'Tweet generated successfully with enhanced meme matching',
    //   session_id,
    //   data: responseData
    // });
    return responseData

  } catch (error) {
    console.error('❌ Tweet generation endpoint failed:', error);
    // res.status(500).json({
    //   success: false,
    //   message: 'Tweet generation endpoint failed',
    //   error: error.message
    // });
    return `Tweet generation endpoint failed: ${error.message}`
  }
};

// ========================= EXPRESS SETUP =========================

// const app = express();

// // Middleware
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Main endpoint
// app.post('/generate-tweet-only', generateTweetOnly);

// // Health check endpoint
// app.get('/health', (req: Request, res: Response) => {
//   res.json({
//     status: 'healthy',
//     active_sessions: Object.keys(activeSessions).length,
//     available_templates: ENHANCED_MEME_TEMPLATES.length,
//     features: {
//       meme_template_matching: 'Enhanced semantic analysis',
//       variation_generation: '5 different approaches',
//       metadata_generation: 'Comprehensive tweet analytics'
//     }
//   });
// });

// // Get available meme templates
// app.get('/meme-templates', (req: Request, res: Response) => {
//   res.json({
//     templates: ENHANCED_MEME_TEMPLATES,
//     total_templates: ENHANCED_MEME_TEMPLATES.length,
//     template_analyzer: 'Enhanced semantic matching with compatibility scoring'
//   });
// });

// // Start server
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`🚀 Tweet Generator API running on port ${PORT}`);
//   console.log(`📊 Available meme templates: ${ENHANCED_MEME_TEMPLATES.length}`);
//   console.log(`🎯 Endpoints: /generate-tweet-only, /health, /meme-templates`);
// });

// export default app;

// ========================= SUMMARY =========================

/**
 * TWEET-ONLY ENDPOINT SCOPE & FUNCTIONS:
 * 
 * CORE FUNCTIONALITY:
 * ✅ Generate viral tweets without character/image generation
 * ✅ Support simple and meme pipelines
 * ✅ Indian/Global meme style support
 * ✅ Enhanced meme template matching using semantic analysis
 * 
 * KEY FUNCTIONS USED:
 * 
 * 1. MemeTemplateAnalyzer Class:
 *    - extractTweetFeatures() - Analyze tweet for meme template matching
 *    - calculateTemplateCompatibility() - Score template compatibility
 *    - findBestMemeTemplate() - Find optimal meme template
 *    - makeFinalTemplateSelection() - AI-powered final selection
 * 
 * 2. TweetGenerator Class:
 *    - detectNiche() - Identify tweet's primary niche/topic
 *    - fetchTopHashtags() - Get trending hashtags for niche
 *    - getBestPostTimes() - Optimal posting times for engagement
 *    - extractSeoKeywords() - SEO-friendly keyword extraction
 *    - generateTweetMetadata() - Complete tweet analytics
 *    - analyzeStyleAndVoice() - User writing style analysis
 *    - generateSingleVariation() - Create single viral variation
 *    - generateViralVariations() - Generate 5 different approaches
 *    - selectBestVariation() - AI-powered variation selection
 *    - generateTweetComplete() - Main orchestration function
 * 
 * 3. Main Endpoint Function:
 *    - generateTweetOnly() - Express route handler
 * 
 * OUTPUT INCLUDES:
 * ✅ Viral tweet content
 * ✅ Generation approach used
 * ✅ Comprehensive metadata (hashtags, SEO keywords, posting times)
 * ✅ Meme template matching (if meme pipeline)
 * ✅ All generated variations
 * ✅ Selection reasoning
 * ✅ Session data and analytics
 * 
 * DEPENDENCIES:
 * - express, openai, cloudinary, axios, cheerio, dotenv
 * - @types/express, @types/node, typescript
 */