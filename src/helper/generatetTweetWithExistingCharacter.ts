
// tweetWithExistingCharacter.ts
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import * as cloudinary from 'cloudinary';
import axios from 'axios';
import * as cheerio from 'cheerio';
import express from 'express';
import multer from 'multer';
import { DateTime } from 'luxon';
import * as dotenv from 'dotenv';
import sharp from "sharp";
import mime from 'mime-types';
import fetch from "node-fetch";
import FormData from "form-data";

// Load environment variables
dotenv.config();

// Initialize express app and multer for file uploads
const app = express();
const upload = multer({ dest: 'uploads/' });

// Setup middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global active sessions store
const active_sessions: { [key: string]: ContentGenerator } = {};

// Art styles
const ART_STYLES: { [key: string]: string } = {
  photorealistic: "Photorealistic/3D Realistic - Ultra-realistic, highly detailed, photographic quality",
  anime: "Studio Ghibli/Anime Style - Japanese animation style with soft colors and expressive characters",
  pixar: "Pixar/3D Animation Style - Colorful 3D animated style with vibrant colors and cartoon features",
  oil_painting: "Oil Painting/Classical Art - Traditional painting style with rich textures and brush strokes",
  comic: "Comic Book/Pop Art Style - Bold colors, strong outlines, and dynamic comic aesthetics"
};

// Image quality options and token costs
const IMAGE_QUALITY_OPTIONS: { [key: string]: any } = {
  basic: {
    quality: "medium",
    tokens: 1056,
    description: "Medium quality rendering - balanced quality and cost"
  },
  advanced: {
    quality: "high", 
    tokens: 4160,
    description: "High quality rendering - premium quality with higher cost"
  }
};

// Enhanced Meme templates (simplified to just 2 for brevity)
const ENHANCED_MEME_TEMPLATES = [
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
  }
];

// MemeTemplateAnalyzer class
class MemeTemplateAnalyzer {
  private client: OpenAI;
  
  constructor(openai_client: OpenAI) {
    this.client = openai_client;
  }
  
  async extract_tweet_features(tweet: string): Promise<any> {
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
      
      let response_text = response.choices[0].message.content?.trim() || "";
      const json_match = response_text.match(/```json\s*(\{.*?\})\s*```/s);
      if (json_match) {
        response_text = json_match[1];
      }
      
      // Clean up response text
      response_text = response_text.replace('```json', '').replace('```', '').trim();
      
      const extracted_features = JSON.parse(response_text);
      
      // Validate and ensure all required fields exist
      const default_features = {
        primary_emotion: "neutral",
        content_type: "observation",
        key_concepts: [],
        conflict_elements: [],
        humor_type: "observational",
        requires_visual_elements: [],
        meme_potential_keywords: []
      };
      
      // Merge with defaults
      for (const [key, default_value] of Object.entries(default_features)) {
        if (!(key in extracted_features)) {
          extracted_features[key] = default_value;
        } else if (typeof extracted_features[key] !== typeof default_value) {
          if (Array.isArray(default_value)) {
            extracted_features[key] = extracted_features[key] ? [String(extracted_features[key])] : [];
          } else {
            extracted_features[key] = extracted_features[key] ? String(extracted_features[key]) : default_value;
          }
        }
      }
      
      return extracted_features;
    } catch (e) {
      console.error(`Tweet feature extraction failed: ${e}`);
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
  
  calculate_template_compatibility(tweet_features: any, template: any): any {
    let compatibility_score = 0;
    const reasons: string[] = [];
    
    // Check keyword matches
    const tweet_keywords = new Set(tweet_features.meme_potential_keywords || []);
    const template_keywords = new Set(template.keywords || []);
    const keyword_overlap = [...tweet_keywords].filter(x => template_keywords.has(x)).length;
    const keyword_score = (keyword_overlap / Math.max(template_keywords.size, 1)) * 30;
    compatibility_score += keyword_score;
    
    if (keyword_overlap > 0) {
      reasons.push(`Keyword matches: ${[...tweet_keywords].filter(x => template_keywords.has(x))}`);
    }
    
    // Check emotional triggers
    const tweet_emotion = (tweet_features.primary_emotion || "").toLowerCase();
    const template_emotions = template.emotional_triggers.map((e: string) => e.toLowerCase());
    if (template_emotions.includes(tweet_emotion)) {
      compatibility_score += 25;
      reasons.push(`Emotional match: ${tweet_emotion}`);
    }
    
    // Check content type alignment
    const content_type = (tweet_features.content_type || "").toLowerCase();
    const use_case = template.use_case.toLowerCase();
    if (content_type.split(' ').some((ct: string) => use_case.includes(ct))) {
      compatibility_score += 20;
      reasons.push(`Content type alignment: ${content_type}`);
    }
    
    // Check humor type compatibility
    const humor_type = (tweet_features.humor_type || "").toLowerCase();
    if (template.use_case.toLowerCase().includes(humor_type)) {
      compatibility_score += 15;
      reasons.push(`Humor type match: ${humor_type}`);
    }
    
    // Bonus for high-strength templates
    const meme_strength = template.meme_strength || 0;
    const strength_bonus = (meme_strength / 100) * 10;
    compatibility_score += strength_bonus;
    
    return {
      template_name: template.name,
      compatibility_score: Math.min(compatibility_score, 100),
      reasons,
      template_data: template
    };
  }
  
  async find_best_meme_template(tweet: string): Promise<any> {
    try {
      // Extract tweet features
      const tweet_features = await this.extract_tweet_features(tweet);
      console.log(`Tweet features extracted: ${JSON.stringify(tweet_features)}`);
      
      // Calculate compatibility for each template
      const template_scores = [];
      for (const template of ENHANCED_MEME_TEMPLATES) {
        const score_data = this.calculate_template_compatibility(tweet_features, template);
        template_scores.push(score_data);
        console.log(`Template ${template.name}: ${score_data.compatibility_score.toFixed(1)}`);
      }
      
      // Sort by compatibility score
      template_scores.sort((a, b) => b.compatibility_score - a.compatibility_score);
      
      // Get top 3 candidates
      const top_candidates = template_scores.slice(0, 3);
      
      // Use GPT to make final selection among top candidates
      const final_selection = await this.make_final_template_selection(tweet, tweet_features, top_candidates);
      
      return {
        best_match: final_selection,
        tweet_features,
        all_scores: template_scores,
        top_candidates
      };
    } catch (e) {
      console.error(`Meme template matching failed: ${e}`);
      return this.get_fallback_template(tweet);
    }
  }
  
  async make_final_template_selection(tweet: string, tweet_features: any, top_candidates: any[]): Promise<any> {
    try {
      const prompt = `Select the BEST meme template for this tweet from the top candidates:

TWEET: "${tweet}"
TWEET FEATURES: ${JSON.stringify(tweet_features, null, 2)}

TOP CANDIDATES:
${JSON.stringify(top_candidates, null, 2)}

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
        model: "gpt-4o",
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
      
      let response_text = response.choices[0].message.content?.trim() || "";
      const json_match = response_text.match(/```json\s*(\{.*?\})\s*```/s);
      if (json_match) {
        response_text = json_match[1];
      }
      
      // Clean up response text
      response_text = response_text.replace('```json', '').replace('```', '').trim();
      
      const selection_data = JSON.parse(response_text);
      
      // Validate selection_data structure
      if (typeof selection_data !== 'object') {
        throw new Error("Invalid selection data format");
      }
      
      // Ensure required fields exist
      const required_fields: {[key: string]: any} = {
        selected_template: "Generated fallback",
        confidence_score: 75,
        visual_adaptation: "Generated fallback",
        why_selected: "Fallback selection"
      };
      
      for (const [field, default_value] of Object.entries(required_fields)) {
        if (!(field in selection_data)) {
          selection_data[field] = default_value;
        }
      }
      
      // Find the selected template data
      const selected_name = selection_data.selected_template || "";
      const selected_candidate = top_candidates.find(c => c.template_name === selected_name) || top_candidates[0];
      
      return {
        template_name: selected_candidate.template_name,
        template_data: selected_candidate.template_data,
        compatibility_score: selected_candidate.compatibility_score,
        confidence_score: selection_data.confidence_score || 80,
        visual_adaptation: selection_data.visual_adaptation || "",
        why_selected: selection_data.why_selected || "Best match based on content analysis",
        reasons: selected_candidate.reasons
      };
    } catch (e) {
      console.error(`Final template selection failed: ${e}`);
      return top_candidates.length ? top_candidates[0] : this.get_fallback_template(tweet).best_match;
    }
  }
  
  get_fallback_template(tweet: string): any {
    const fallback = {
      template_name: "Drake Hotline Bling",
      template_data: ENHANCED_MEME_TEMPLATES[0], // Drake is first in list
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

// ContentGenerator class
class ContentGenerator {
  public session_id: string;
  private api_key: string;
  private client: OpenAI;
  public temp_dir: string;
  private api_lock: any;
  private meme_analyzer: MemeTemplateAnalyzer;
  public session_data: any;
  
  constructor(session_id: string) {
    this.session_id = session_id;
    this.api_key = process.env.OPENAI_API_KEY || '';
    if (!this.api_key) {
      throw new Error("OpenAI API key not found");
    }
    
    // Configure Cloudinary
    cloudinary.v2.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new Error("Cloudinary configuration not found");
    }
    
    this.client = new OpenAI({ apiKey: this.api_key });
    this.temp_dir = path.join(process.cwd(), `temp_${this.session_id}`);
    if (!fs.existsSync(this.temp_dir)) {
      fs.mkdirSync(this.temp_dir, { recursive: true });
    }
    
    this.api_lock = new (require('events')).EventEmitter();
    this.api_lock.setMaxListeners(0);
    
    // Initialize meme analyzer
    this.meme_analyzer = new MemeTemplateAnalyzer(this.client);
    
    // Initialize session data
    this.session_data = {
      session_id: this.session_id,
      created_at: new Date().toISOString(),
      pipeline_type: null,
      meme_style: null,
      final_tweet: null,
      tweet_metadata: null,
      meme_template_data: null,
      character_image_url: null,
      action_image_url: null,
      cloudinary_urls: [],
      pending_character_approval: null,
      token_usage: {
        total_tokens: 0,
        character_generation_tokens: 0,
        action_generation_tokens: 0,
        image_generations: []
      }
    };
  }

  safe_get_nested(data: any, ...args: any[]): any {
    const default_value = args[args.length - 1];
    const keys = args.slice(0, -1);
    
    let current = data;
    for (const key of keys) {
      if (typeof current === 'object' && current !== null && key in current) {
        current = current[key];
      } else {
        return default_value;
      }
    }
    return current !== null && current !== undefined ? current : default_value;
  }

  track_image_generation(image_type: string, quality: string, tokens_used: number): void {
    const generation_record = {
      type: image_type,
      quality,
      tokens: tokens_used,
      timestamp: new Date().toISOString()
    };
    
    this.session_data.token_usage.image_generations.push(generation_record);
    this.session_data.token_usage.total_tokens += tokens_used;
    
    if (image_type === "character") {
      this.session_data.token_usage.character_generation_tokens += tokens_used;
    } else if (image_type === "action") {
      this.session_data.token_usage.action_generation_tokens += tokens_used;
    }
    
    console.log(`Token usage tracked: ${image_type} - ${quality} - ${tokens_used} tokens`);
  }

  async upload_to_cloudinary(file_path: string, resource_type: "image" | "auto" | "video" | "raw" = "image"): Promise<string | null> {
    try {
      const response = await new Promise<any>((resolve, reject) => {
        cloudinary.v2.uploader.upload(
          file_path, 
          { 
            resource_type,
            public_id: `${this.session_id}_${Date.now()}_${path.basename(file_path, path.extname(file_path))}`
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
      });
      
      const url = response?.secure_url;
      if (url) {
        this.session_data.cloudinary_urls.push(url);
        console.log(`Successfully uploaded to Cloudinary: ${url}`);
      }
      return url || null;
    } catch (e) {
      console.error(`Cloudinary upload failed: ${e}`);
      console.error(`Traceback: ${e instanceof Error ? e.stack : e}`);
      return null;
    }
  }

  async upload_json_to_cloudinary(json_data: any, filename: string): Promise<string | null> {
    try {
      const temp_json_path = path.join(this.temp_dir, `${filename}.json`);
      fs.writeFileSync(temp_json_path, JSON.stringify(json_data, null, 2), 'utf-8');
      
      const response = await new Promise<any>((resolve, reject) => {
        cloudinary.v2.uploader.upload(
          temp_json_path,
          { 
            resource_type: "raw",
            public_id: `${this.session_id}_${filename}`
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
      });
      
      const url = response?.secure_url;
      if (url) {
        this.session_data.cloudinary_urls.push(url);
        console.log(`JSON uploaded to Cloudinary: ${url}`);
      }
      
      fs.unlinkSync(temp_json_path);
      return url || null;
    } catch (e) {
      console.error(`JSON upload failed: ${e}`);
      console.error(`Traceback: ${e instanceof Error ? e.stack : e}`);
      return null;
    }
  }

  cleanup_local_files(): void {
    try {
      if (fs.existsSync(this.temp_dir)) {
        fs.rmSync(this.temp_dir, { recursive: true, force: true });
        console.log(`Cleaned up temp directory: ${this.temp_dir}`);
      }
    } catch (e) {
      console.warn(`Could not clean up temp directory: ${e}`);
    }
  }

  // Tweet generation methods
  async detect_niche(tweet: string): Promise<string> {
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
            content: `${tweet.substring(0, 2000)}`
          }
        ],
        max_tokens: 10,
        temperature: 0.1
      });

      let niche = response.choices[0].message.content?.trim().toLowerCase() || "lifestyle";
      niche = niche.replace(/[^\w\s]/g, '');
      niche = niche.split(/\s+/)[0] || "lifestyle";
      return niche;
    } catch (e) {
      console.error(`Niche detection failed: ${e}`);
      return "lifestyle";
    }
  }

  async fetch_top_hashtags(niche: string, count: number = 10): Promise<string[]> {
    const url = `https://best-hashtags.com/hashtag/${niche.toLowerCase()}/`;
    const headers = {"User-Agent": "Mozilla/5.0 (compatible; HashtagScraper/1.0)"};

    try {
      const response = await axios.get(url, { headers, timeout: 10000 });
      const $ = cheerio.load(response.data);

      const popular_div = $("#popular");
      if (!popular_div.length) {
        return [];
      }

      const table = popular_div.find("table.table");
      if (!table.length) {
        return [];
      }

      const hashtags: string[] = [];
      table.find("tbody tr").slice(0, count).each((_, row) => {
        const cols = $(row).find("td");
        if (cols.length !== 3) {
          return;
        }
        const hashtag = $(cols[1]).text().trim();
        hashtags.push(hashtag);
      });

      return hashtags;
    } catch (e) {
      console.error(`Hashtag fetching failed: ${e}`);
      return [];
    }
  }

  async get_best_post_times(niche: string, platform: string = "Twitter", timezone_str: string = "Asia/Kolkata"): Promise<string[]> {
    try {
      const now = DateTime.now().setZone(timezone_str);
      const formatted_time = now.toFormat("cccc, LLLL dd, yyyy 'at' hh:mm a");

      const prompt = (
        `As of now (${formatted_time}, ${timezone_str}), suggest the next 3 best times ` +
        `to post on ${platform} for the '${niche}' niche to get maximum engagement or go viral. ` +
        "Only include times that are upcoming (i.e., later today or this week). " +
        "Respond with only the times in short bullet point format, no extra text or intro, try to use minimum text."
      );

      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {role: "system", content: "You are a social media growth strategist and twitter/x expert."},
          {role: "user", content: prompt}
        ],
        temperature: 0.3,
        max_tokens: 100
      });

      const raw = response.choices[0].message.content?.trim() || "";
      const times = raw.split("\n")
                      .filter(line => line.trim())
                      .map(line => line.replace(/^[•\-\s]+/, "").trim());
      return times.slice(0, 3);
    } catch (e) {
      console.error(`Post times fetching failed: ${e}`);
      return [];
    }
  }

  async extract_seo_keywords(tweet: string, count: number = 10): Promise<string[]> {
    try {
      const prompt = (
        `From the following tweet, extract ${count} SEO-friendly keywords that could be useful for search optimization. ` +
        "Focus on meaningful words like nouns, adjectives, and relevant verbs. Ignore common stop words. " +
        "Return only the keywords in plain text, one per line, no explanations.\n\n" +
        `Tweet: ${tweet}`
      );

      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {role: "system", content: "You are an expert in SEO keyword extraction."},
          {role: "user", content: prompt}
        ],
        temperature: 0.3,
        max_tokens: 150
      });

      const raw = response.choices[0].message.content?.trim() || "";
      const keywords = raw.split("\n")
                         .filter(line => line.trim())
                         .map(line => line.replace(/^[•\-\s]+/, "").trim().toLowerCase());
      return keywords;
    } catch (e) {
      console.error(`SEO keyword extraction failed: ${e}`);
      return [];
    }
  }

  async generate_tweet_metadata(tweet: string, platform: string = "Twitter", timezone_str: string = "Asia/Kolkata"): Promise<any> {
    try {
      const niche = await this.detect_niche(tweet);
      const best_times = await this.get_best_post_times(niche, platform, timezone_str);
      const seo_keywords = await this.extract_seo_keywords(tweet, 10);
      const hashtags = await this.fetch_top_hashtags(niche, 15);

      const metadata = {
        tweet,
        niche,
        optimal_posting_times: best_times,
        seo_keywords,
        recommended_hashtags: hashtags,
        platform,
        timezone: timezone_str,
        analysis_date: new Date().toISOString()
      };

      return metadata;
    } catch (e) {
      console.error(`Tweet metadata generation failed: ${e}`);
      return {tweet, error: String(e)};
    }
  }

  async analyze_style_and_voice(previous_content: string[]): Promise<any> {
    if (!previous_content || previous_content.length === 0) {
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
    
    const combined_content = previous_content.map((content, i) => `Post ${i+1}: ${content}`).join("\n\n");
    
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
            content: `Analyze these previous posts to understand their unique writing style and voice.

PREVIOUS POSTS:
${combined_content}

Provide analysis in JSON format with voice_characteristics, engagement_patterns, writing_structure, and vocabulary_style.`
          }
        ],
        max_tokens: 1500,
        temperature: 0.1
      });
      
      let analysis_text = response.choices[0].message.content?.trim() || "";
      const json_match = analysis_text.match(/```json\s*(\{.*?\})\s*```/s);
      if (json_match) {
        analysis_text = json_match[1];
      }
      
      return JSON.parse(analysis_text);
    } catch (e) {
      console.error(`Style analysis failed: ${e}`);
      return {error: String(e)};
    }
  }

  async generate_single_variation(approach: string, raw_thoughts: string, style_analysis: any, 
                                pipeline_type: string, meme_style: string | null = null): Promise<any> {
    // Customize prompt based on pipeline type
    let extra_requirements = "";
    
    if (pipeline_type === "meme") {
      let cultural_context = "";
      if (meme_style === "Indian") {
        cultural_context = "Uses Indian cultural references, daily situations, and relatable Indian experiences. Incorporates popular Indian meme formats and jokes use Hindi and Hinglish but stay in the boundary of user thoughts/input and very funny and dank meme if needed.";
      } else {
        cultural_context = "Uses global cultural references and universally relatable situations. Incorporates popular international meme formats and jokes which are famouse globally make it funny, dank joke or double meaning when needed.";
      }
      
      extra_requirements = `
      ✅ EXTREMELY FUNNY and MEME-WORTHY with ${meme_style?.toLowerCase() || 'global'} humor
      ${cultural_context}
      ✅ Uses relatable exaggeration typical of ${meme_style?.toLowerCase() || 'global'} memes
      ✅ Follows viral ${meme_style?.toLowerCase() || 'global'} meme best practices
      ✅ Should work perfectly with visual meme templates
      `;
    } else {
      extra_requirements = `
      ✅ Professional yet engaging tone
      ✅ Clear value proposition
      ✅ Universally relatable content
      `;
    }
    
    const prompt = `You are an expert viral social media copywriter. Create a ${pipeline_type} tweet that is:

    ✅ Emotionally striking (humor, vulnerability, or mild controversy)
    ✅ Reads like something a real person would post
    ✅ Stays under 280 characters
    ✅ Uses simple, clear, natural language
    ✅ Safe for work and platform-compliant
    ✅ NO hashtags - only regular words
    ${extra_requirements}

    APPROACH: ${approach}
    RAW THOUGHTS: "${raw_thoughts}"
    USER STYLE: ${JSON.stringify(style_analysis, null, 2)}

    Return JSON with: content, approach, viral_elements, engagement_prediction, target_emotion, character_count`;
    
    try {
      // Using a promise to simulate mutex lock
      const acquire = async () => {
        return new Promise<void>(resolve => {
          this.api_lock.once('release', resolve);
          setTimeout(resolve, 100); // Timeout as fallback
        });
      };
      
      await acquire();
      
      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert viral ${pipeline_type} content creator who creates engaging social media content.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.3
      });
      
      this.api_lock.emit('release');
      
      let response_text = response.choices[0].message.content?.trim() || "";
      const json_match = response_text.match(/```json\s*(\{.*?\})\s*```/s);
      if (json_match) {
        response_text = json_match[1];
      }
      
      const variation_data = JSON.parse(response_text);
      const content = variation_data.content || "";
      variation_data.character_count = content.length;
      
      // Ensure approach is always a string
      if (!variation_data.approach || typeof variation_data.approach !== 'string') {
        variation_data.approach = approach;
      }
      
      // Validate required fields
      const required_fields = ["content", "approach", "viral_elements", "engagement_prediction", "target_emotion"];
      for (const field of required_fields) {
        if (!(field in variation_data)) {
          variation_data[field] = field !== "approach" ? `Generated ${field}` : approach;
        }
      }
      
      return variation_data;
    } catch (e) {
      console.error(`Variation generation failed: ${e}`);
      return {
        content: `Error generating ${approach} variation`,
        approach,
        error: String(e),
        character_count: 0,
        viral_elements: [],
        engagement_prediction: "low",
        target_emotion: "neutral"
      };
    }
  }

  async generate_viral_variations(raw_thoughts: string, style_analysis: any, 
                                pipeline_type: string, meme_style: string | null = null): Promise<any[]> {
    const approaches = [
      "Hook-driven",
      "Storytelling", 
      "Controversial/Contrarian",
      "Educational/Value-packed",
      "Emotional/Relatable"
    ];
    
    const variations: any[] = [];
    
    try {
      // Create promises for all variations
      const promises = approaches.map(approach => 
        this.generate_single_variation(approach, raw_thoughts, style_analysis, pipeline_type, meme_style)
      );
      
      // Wait for all to complete
      const results = await Promise.allSettled(promises);
      
      // Process results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const variation = result.value;
          // Ensure approach is always a string
          if (typeof variation.approach !== 'string') {
            variation.approach = approaches[index];
          }
          variations.push(variation);
        } else {
          console.error(`Error generating ${approaches[index]} variation: ${result.reason}`);
          variations.push({
            content: `Fallback ${approaches[index]} variation`,
            approach: approaches[index],
            error: String(result.reason),
            character_count: 0,
            viral_elements: [],
            engagement_prediction: "low",
            target_emotion: "neutral"
          });
        }
      });
    } catch (e) {
      console.error(`Parallel generation failed: ${e}`);
      return [];
    }
    
    // Sort by approach order with safe key extraction
    const approach_order: {[key: string]: number} = {};
    approaches.forEach((approach, index) => {
      approach_order[approach] = index;
    });
    
    try {
      variations.sort((a, b) => {
        const aOrder = approach_order[String(a.approach || "")] ?? 999;
        const bOrder = approach_order[String(b.approach || "")] ?? 999;
        return aOrder - bOrder;
      });
    } catch (e) {
      console.error(`Sorting failed: ${e}`);
      // Manual sorting as fallback
      const sorted_variations: any[] = [];
      for (const approach of approaches) {
        for (const variation of variations) {
          if (String(variation.approach || "") === approach) {
            sorted_variations.push(variation);
            break;
          }
        }
      }
      // Add any remaining variations
      for (const variation of variations) {
        if (!sorted_variations.includes(variation)) {
          sorted_variations.push(variation);
        }
      }
      return sorted_variations;
    }
    
    return variations;
  }

async select_best_variation(raw_thoughts: string, variations: any[], style_analysis: any): Promise<any> {
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
            content: `Select the best tweet variation based on authenticity, viral potential, and message alignment.

ORIGINAL THOUGHTS: "${raw_thoughts}"
STYLE: ${JSON.stringify(style_analysis, null, 2)}
VARIATIONS: ${JSON.stringify(variations, null, 2)}

Return JSON with best_variation containing: index, content, approach, total_score, why_selected`
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      });
      
      let response_text = response.choices[0].message.content?.trim() || "";
      const json_match = response_text.match(/```json\s*(\{.*?\})\s*```/s);
      if (json_match) {
        response_text = json_match[1];
      }
      
      // Clean up response text
      response_text = response_text.replace('```json', '').replace('```', '').trim();
      
      const result = JSON.parse(response_text);
      
      // Validate result structure
      if (typeof result !== 'object' || !result || !("best_variation" in result)) {
        throw new Error("Invalid result structure");
      }
      
      // Ensure best_variation has required fields
      const best_var = result.best_variation;
      if (typeof best_var !== 'object') {
        throw new Error("best_variation is not a dictionary");
      }
      
      // Validate and set defaults for required fields
      const required_fields: {[key: string]: any} = {
        index: 0,
        content: variations.length ? variations[0]?.content || "" : "",
        approach: variations.length ? variations[0]?.approach || "" : "",
        total_score: 75,
        why_selected: "Fallback selection"
      };
      
      for (const [field, default_value] of Object.entries(required_fields)) {
        if (!(field in best_var)) {
          best_var[field] = default_value;
        }
      }
      
      return result;
    } catch (e) {
      console.error(`Variation selection failed: ${e}`);
      return {
        best_variation: {
          index: 0,
          content: variations.length ? variations[0]?.content || "" : "",
          approach: variations.length ? variations[0]?.approach || "" : "",
          total_score: 75,
          why_selected: "Fallback selection"
        }
      };
    }
  }

  async generate_tweet_complete(raw_thoughts: string, previous_content: string[], 
                              pipeline_type: string, meme_style: string  = 'Indian'): Promise<any> {
    try {
      // Analyze style
      const style_analysis = await this.analyze_style_and_voice(previous_content);
      
      // Generate variations
      const variations = await this.generate_viral_variations(raw_thoughts, style_analysis, pipeline_type, meme_style);
      
      if (!variations || variations.length === 0) {
        return {error: "Failed to generate variations"};
      }
      
      // Select best variation
      const selection_results = await this.select_best_variation(raw_thoughts, variations, style_analysis);
      
      // Get best tweet
      const best_tweet = selection_results?.best_variation?.content || "";
      
      // Generate metadata
      const tweet_metadata = await this.generate_tweet_metadata(best_tweet);
      
      // Find meme template if meme pipeline
      let meme_template_data = null;
      if (pipeline_type === "meme" && best_tweet) {
        console.log(`Finding meme template for: ${best_tweet}`);
        meme_template_data = await this.meme_analyzer.find_best_meme_template(best_tweet);
        console.log(`Selected meme template: ${meme_template_data?.best_match?.template_name || 'None'}`);
      }
      
      // Store in session
      this.session_data = {
        ...this.session_data,
        pipeline_type,
        meme_style,
        final_tweet: best_tweet,
        tweet_metadata,
        meme_template_data
      };
      
      return {
        best_tweet,
        approach: selection_results?.best_variation?.approach || "",
        metadata: tweet_metadata,
        meme_template: meme_template_data,
        variations
      };
    } catch (e) {
      console.error(`Tweet generation failed: ${e}`);
      console.error(`Traceback: ${e instanceof Error ? e.stack : e}`);
      return {error: String(e)};
    }
  }



async generate_action_image(
  tweet_content: string,
  character_data: any,
  existing_image_path: string | null = null,
  image_quality: string = "basic"
): Promise<string | null> {
  const timestamp = Date.now().toString();
  const temp_filename = path.join(this.temp_dir, `action_${timestamp}.png`);

  if (!IMAGE_QUALITY_OPTIONS[image_quality]) {
    console.warn(`Invalid image quality '${image_quality}', defaulting to 'basic'`);
    image_quality = "basic";
  }

  const quality_config = IMAGE_QUALITY_OPTIONS[image_quality];

  try {
    console.log(`Generating action image with ${image_quality} quality (${quality_config.quality})`);

    const meme_template_data = this.safe_get_nested(this.session_data, "meme_template_data", "best_match", {});
    const template_name = meme_template_data?.template_name || "None";
    console.log(`Using meme template: ${template_name}`);

    let template_prompt = "";
    if (meme_template_data) {
      const template_info = meme_template_data.template_data || {};
      const visual_adaptation = meme_template_data.visual_adaptation || "";

      template_prompt = `
            CRITICAL: This MUST follow the ${template_name} meme template EXACTLY:

            TEMPLATE STRUCTURE: ${template_info.visual_structure || ""}
            LAYOUT REQUIREMENTS: ${template_info.layout_requirements || ""}
            TEMPLATE FORMAT: ${template_info.template_format || ""}
            VISUAL ADAPTATION: ${visual_adaptation}

            MANDATORY TEMPLATE ADHERENCE:
            - Follow the exact visual structure of ${template_name}
            - Use the specific layout requirements provided
            - Maintain the template's characteristic composition
            - Ensure the meme format is instantly recognizable
            - DO NOT deviate from the template structure`;
                }

    if (existing_image_path && fs.existsSync(existing_image_path)) {
      const action_prompt = `Transform this character to create a ${template_name} meme based on: "${tweet_content}"

${template_prompt}

        EDITING REQUIREMENTS:
        - Keep character's original appearance exactly the same
        - Maintain the details of the characters accurately
        - Make character fit perfectly into the ${template_name} template structure
        - Follow the template's visual composition precisely
        - ${character_data?.art_style || "High quality artwork"}
        - The image must be instantly recognizable as a ${template_name} meme
        - Include minimal, strategic text that enhances the meme. DO NOT PASTE ALL THE TEXT OF THE TWEET ON IMAGE DIRECTLY.
        - Ensure professional funny meme quality 

        Tweet Content: ${tweet_content}
        Character Style: ${character_data?.art_style || "High quality artwork"}
        Template: ${template_name}`;

     try {
  const prepared_path = path.join(this.temp_dir, `prepared_${timestamp}.png`);

  // 🔧 Resize and convert to PNG (guaranteed valid format)
  await sharp(existing_image_path)
    .resize(1024, 1024)
    .ensureAlpha()
    .png()
    .toFile(prepared_path);

  const mimeType = mime.lookup(prepared_path);
  console.log(`Prepared image MIME type: ${mimeType}`);

  if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType || "")) {
    throw new Error("Invalid file type after preparation.");
  }

  // 🧪 Prepare form data with explicit MIME
  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("prompt", action_prompt);
  form.append("n", "1");
  form.append("size", "1024x1024");
  form.append("image", fs.createReadStream(prepared_path), {
    contentType: "image/png",
    filename: "prepared.png",
  });

  // 🚀 Make the API request manually
  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("Image edit failed:", result);
    return this.generate_action_image(tweet_content, character_data, null, image_quality);
  }

  if (result.data?.[0]?.b64_json) {
    const image_base64 = result.data[0].b64_json;
    const image_bytes = Buffer.from(image_base64, "base64");

    await fsPromises.writeFile(
      temp_filename,
      new Uint8Array(image_bytes.buffer, image_bytes.byteOffset, image_bytes.byteLength)
    );

    console.log("✅ Image edited and saved successfully!");
  } else {
    console.error("No base64 image returned by OpenAI:", result);
    return null;
  }
} catch (edit_error) {
  console.error("Image edit failed:", edit_error);
  return this.generate_action_image(tweet_content, character_data, null, image_quality);
}
    } else {
      const action_prompt = `Create a ${template_name} meme featuring this character: ${character_data?.character_prompt || ""}

Tweet Content: "${tweet_content}"

${template_prompt}

GENERATION REQUIREMENTS:
- Character: ${character_data?.character_prompt || ""}
- Art Style: ${character_data?.art_style || "High quality artwork"}
- MUST follow ${template_name} template structure EXACTLY
- Professional meme quality with high detail
- Include strategic text that enhances the meme message
- Background and composition must match template requirements
- The final image must be instantly recognizable as a ${template_name} meme
- Ensure viral meme potential
- Have boundaries and make sure everything comes inside that only. No content should go out of the 1024x1024 box`;

      const response = await this.client.images.generate({
        model: "gpt-image-1",
        prompt: action_prompt,
        n: 1,
        size: "1024x1024",
        quality: quality_config.quality
      });

      this.track_image_generation("action", image_quality, quality_config.tokens);

      const image_base64 = response.data[0]?.b64_json;
      if (!image_base64) {
        console.error("No base64 image data received from generation API");
        return null;
      }

      const image_bytes = Buffer.from(image_base64, "base64");
     await fsPromises.writeFile(
                  temp_filename,
                  new Uint8Array(image_bytes.buffer, image_bytes.byteOffset, image_bytes.byteLength)
                );

    }

    const cloudinary_url = await this.upload_to_cloudinary(temp_filename);
    if (cloudinary_url) {
      fs.unlinkSync(temp_filename);
      console.log(`Action image uploaded to Cloudinary: ${cloudinary_url}`);
      return cloudinary_url;
    } else {
      console.error("Failed to upload action image to Cloudinary");
      return null;
    }
  } catch (e) {
    console.error(`Action image generation failed: ${e}`);
    console.error(`Traceback: ${e instanceof Error ? e.stack : e}`);
    return null;
  }
}

}

//----------------------------------------route----------------------------------------------------------//

// API endpoint for generate-tweet-with-existing-character
// app.post('/generate-tweet-with-existing-character', upload.single('character_image'), async (req, res) => {
//   try {
//     const { session_id, raw_thoughts, art_style, pipeline_type, image_quality = "basic", previous_content } = req.body;
    
//     // Validate required fields
//     if (!session_id || !raw_thoughts || !art_style || !pipeline_type || !req.file) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields or character image",
//         session_id
//       });
//     }
    
//     // Get session
//     if (!active_sessions[session_id]) {
//       return res.status(404).json({
//         success: false,
//         message: "Session not found",
//         session_id
//       });
//     }
    
//     const generator = active_sessions[session_id];
    
//     // Validate art style
//     if (!(art_style in ART_STYLES)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid art style",
//         session_id
//       });
//     }
    
//     // Validate image quality
//     if (!(image_quality in IMAGE_QUALITY_OPTIONS)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid image quality. Must be 'basic' or 'advanced'",
//         session_id
//       });
//     }
    
//     // Parse previous content
//     let previous_content_list: string[] = [];
//     if (previous_content) {
//       try {
//         previous_content_list = JSON.parse(previous_content);
//       } catch {
//         previous_content_list = [previous_content];
//       }
//     }
    
//     // Save uploaded character image
//     const character_image_path = path.join(generator.temp_dir, `character_${Date.now()}.png`);
//     fs.copyFileSync(req.file.path, character_image_path);
//     fs.unlinkSync(req.file.path); // Clean up the multer temp file
    
//     // Upload character to Cloudinary
//     const character_url = await generator.upload_to_cloudinary(character_image_path);
//     if (!character_url) {
//       return res.status(500).json({
//         success: false,
//         message: "Failed to upload character image",
//         session_id
//       });
//     }
    
//     // Generate tweet
//     const tweet_result = await generator.generate_tweet_complete(
//       raw_thoughts,
//       previous_content_list,
//       pipeline_type,
//       generator.session_data.meme_style
//     );
    
//     if ("error" in tweet_result) {
//       return res.status(500).json({
//         success: false,
//         message: tweet_result.error,
//         session_id
//       });
//     }
    
//     // Generate action image with enhanced meme template adherence
//     const character_data = {
//       character_image_url: character_url,
//       art_style: ART_STYLES[art_style],
//       source: "existing_image"
//     };
    
//     generator.session_data.character_image_url = character_url;
    
//     const action_image_url = await generator.generate_action_image(
//       tweet_result.best_tweet,
//       character_data,
//       character_image_path,
//       image_quality
//     ); 
    
//     if (action_image_url) {
//       generator.session_data.action_image_url = action_image_url;
//     }
    
//     // Save session data
//     const json_url = await generator.upload_json_to_cloudinary(generator.session_data, "complete_session");
    
//     // Clean up temp files
//     generator.cleanup_local_files();
    
//     return res.status(200).json({
//       success: true,
//       message: "Tweet and action image generated with enhanced meme template matching",
//       session_id,
//       data: {
//         tweet: tweet_result.best_tweet,
//         approach: tweet_result.approach,
//         metadata: tweet_result.metadata,
//         meme_template: tweet_result.meme_template,
//         character_image_url: character_url,
//         action_image_url,
//         image_quality,
//         session_data_url: json_url,
//         cloudinary_urls: generator.session_data.cloudinary_urls,
//         token_usage: generator.session_data.token_usage
//       }
//     });
    
//   } catch (e) {
//     console.error(`Tweet with existing character failed: ${e}`);
//     console.error(`Traceback: ${e instanceof Error ? e.stack : e}`);
//     return res.status(500).json({
//       success: false,
//       message: String(e),
//       session_id: req.body.session_id
//     });
//   }
// });

// Export for use in other files
export {
  active_sessions,
  ContentGenerator,
  MemeTemplateAnalyzer,
  ART_STYLES,
  IMAGE_QUALITY_OPTIONS,
  ENHANCED_MEME_TEMPLATES
};

export default app;