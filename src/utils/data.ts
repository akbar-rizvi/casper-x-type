export const ART_STYLES = {
    "photorealistic": "Photorealistic/3D Realistic - Ultra-realistic, highly detailed, photographic quality",
    "anime": "Studio Ghibli/Anime Style - Japanese animation style with soft colors and expressive characters",
    "pixar": "Pixar/3D Animation Style - Colorful 3D animated style with vibrant colors and cartoon features",
    "oil_painting": "Oil Painting/Classical Art - Traditional painting style with rich textures and brush strokes",
    "comic": "Comic Book/Pop Art Style - Bold colors, strong outlines, and dynamic comic aesthetics"
}


export const IMAGE_QUALITY_OPTIONS = {
    "basic": {
        "quality": "medium",
        "tokens": 1056,
        "description": "Medium quality rendering - balanced quality and cost"
    },
    "advanced": {
        "quality": "high", 
        "tokens": 4160,
        "description": "High quality rendering - premium quality with higher cost"
    }
}

export const ENHANCED_MEME_TEMPLATES = [
    {
        "name": "Drake Hotline Bling",
        "description": "Two-panel vertical layout: top panel rejection, bottom panel approval",
        "use_case": "comparing options, preferences, choices, before/after",
        "keywords": ["choice", "preference", "compare", "vs", "better", "worse", "reject", "accept", "old", "new"],
        "emotional_triggers": ["decision", "upgrade", "improvement", "selection"],
        "visual_structure": "Two vertical panels with same character in different poses",
        "layout_requirements": "TOP: Drake pointing away with rejecting expression, BOTTOM: Drake pointing toward with approving smile",
        "template_format": "comparison_vertical",
        "ideal_for": "contrasting options, rejection vs approval, this vs that",
        "meme_strength": 95
    },
    {
        "name": "Distracted Boyfriend",
        "description": "Man turning from girlfriend to check out another woman",
        "use_case": "distraction, temptation, shifting attention, betrayal, choosing between options",
        "keywords": ["temptation", "distraction", "new", "old", "choice", "betrayal", "switching", "leaving"],
        "emotional_triggers": ["temptation", "curiosity", "desire", "conflict"],
        "visual_structure": "Single panel showing three people in triangle formation",
        "layout_requirements": "Man turning from girlfriend toward other woman, girlfriend looking disapproving",
        "template_format": "triangle_relationship",
        "ideal_for": "distraction, temptation, shifting attention, betrayal, choosing between options",
        "meme_strength": 98
    },
    {
        "name": "Surprised Pikachu",
        "description": "Pikachu with wide-eyed shocked expression",
        "use_case": "mock surprise, predictable outcomes, feigned shock, obvious results",
        "keywords": ["surprise", "shock", "obvious", "predictable", "expected", "wow", "really"],
        "emotional_triggers": ["surprise", "sarcasm", "mockery", "obviousness"],
        "visual_structure": "Single panel close-up of Pikachu's face",
        "layout_requirements": "Pikachu with wide eyes and open mouth showing exaggerated surprise",
        "template_format": "single_reaction",
        "ideal_for": "mock surprise, predictable outcomes, feigned shock, obvious results",
        "meme_strength": 92
    },
    {
        "name": "Woman Yelling at Cat",
        "description": "Split image of yelling woman and confused cat at dinner table",
        "use_case": "arguments, confusion, misunderstanding, confrontation, talking past each other",
        "keywords": ["argument", "confusion", "misunderstanding", "fight", "confrontation", "different views"],
        "emotional_triggers": ["anger", "confusion", "frustration", "confrontation"],
        "visual_structure": "Two panels showing woman and cat in confrontational setup",
        "layout_requirements": "LEFT: woman pointing and yelling, RIGHT: confused cat at table with food",
        "template_format": "split_confrontation",
        "ideal_for": "arguments, confusion, misunderstanding, confrontation, talking past each other",
        "meme_strength": 94
    },
    {
        "name": "Mocking SpongeBob",
        "description": "Distorted SpongeBob with alternating caps text for sarcastic repetition",
        "use_case": "sarcasm, mocking, repetition, making fun, mimicking",
        "keywords": ["sarcasm", "mocking", "mimic", "repeat", "ridiculous", "silly", "making fun"],
        "emotional_triggers": ["sarcasm", "mockery", "ridicule", "humor"],
        "visual_structure": "Single panel showing distorted SpongeBob",
        "layout_requirements": "SpongeBob with distorted, mocking expression, typically with alternating caps text",
        "template_format": "single_mockery",
        "ideal_for": "sarcasm, mocking, making fun, mimicking someone",
        "meme_strength": 89
    },
    {
        "name": "Two Buttons",
        "description": "Character sweating while looking at two red buttons on table",
        "use_case": "difficult decisions, impossible choices, moral dilemmas",
        "keywords": ["decision", "choice", "difficult", "dilemma", "impossible", "stuck", "choose"],
        "emotional_triggers": ["anxiety", "pressure", "indecision", "stress"],
        "visual_structure": "Single panel with stressed character, table, and two buttons",
        "layout_requirements": "Character behind table with two red buttons, showing stress/sweat, difficult decision body language",
        "template_format": "decision_stress",
        "ideal_for": "hard choices, conflicting desires, dilemmas",
        "meme_strength": 91
    },
    {
        "name": "Expanding Brain",
        "description": "Series of panels showing increasing enlightenment from normal to cosmic brain",
        "use_case": "enlightenment, escalation, increasing absurdity, levels of intelligence",
        "keywords": ["smart", "genius", "evolution", "levels", "upgrade", "enlightenment", "intelligence"],
        "emotional_triggers": ["intelligence", "superiority", "evolution", "enlightenment"],
        "visual_structure": "Multiple panels showing progressive brain expansion",
        "layout_requirements": "Sequential panels with increasingly large/glowing brain, showing escalating enlightenment",
        "template_format": "progressive_evolution",
        "ideal_for": "enlightenment, escalation, increasing absurdity, levels of understanding",
        "meme_strength": 87
    },
    {
        "name": "Hide the Pain Harold",
        "description": "Older man forcing smile while experiencing discomfort",
        "use_case": "hidden pain, fake smiles, discomfort, suffering in silence",
        "keywords": ["pain", "fake", "smile", "suffering", "hiding", "discomfort", "pretending"],
        "emotional_triggers": ["pain", "suffering", "pretense", "discomfort"],
        "visual_structure": "Single panel showing Harold's forced smile",
        "layout_requirements": "Harold with forced smile that doesn't hide the pain in his eyes",
        "template_format": "single_suffering",
        "ideal_for": "hidden pain, fake smiles, discomfort, suffering in silence",
        "meme_strength": 88
    },
    {
        "name": "This Is Fine",
        "description": "Dog sitting in burning room saying everything is fine",
        "use_case": "denial, ignoring problems, everything falling apart, false optimism",
        "keywords": ["fine", "okay", "disaster", "burning", "denial", "ignoring", "problems"],
        "emotional_triggers": ["denial", "anxiety", "false comfort", "disaster"],
        "visual_structure": "Single panel showing dog in burning room",
        "layout_requirements": "Dog calmly sitting with coffee in chaotic burning environment",
        "template_format": "single_denial",
        "ideal_for": "denial, ignoring problems, everything falling apart, false optimism",
        "meme_strength": 96
    },
    {
        "name": "Always Has Been",
        "description": "Two astronauts with plot twist revelation, second about to shoot first",
        "use_case": "plot twists, revelations, always been true, shocking discoveries",
        "keywords": ["always", "truth", "revelation", "discovery", "plot twist", "reality", "shocking"],
        "emotional_triggers": ["revelation", "shock", "realization", "truth"],
        "visual_structure": "Two panels showing astronauts in space",
        "layout_requirements": "Panel 1: astronaut realizing truth, Panel 2: second astronaut with gun saying 'always has been'",
        "template_format": "revelation_sequence",
        "ideal_for": "plot twists, revelations, always been true, shocking discoveries",
        "meme_strength": 93
    },
    {
        "name": "Gru's Plan",
        "description": "Four-panel sequence from Despicable Me where plan backfires",
        "use_case": "plans backfiring, ironic failures, unexpected outcomes",
        "keywords": ["plan", "backfire", "failure", "unexpected", "ironic", "went wrong"],
        "emotional_triggers": ["irony", "failure", "disappointment", "surprise"],
        "visual_structure": "Four panels showing progression from plan to backfire",
        "layout_requirements": "Panel 1-3: Gru presenting plan confidently, Panel 4: Gru realizing plan backfired",
        "template_format": "plan_backfire_sequence",
        "ideal_for": "showing plans backfiring, ironic failures, unexpected outcomes",
        "meme_strength": 90
    },
    {
        "name": "Buff Doge vs Cheems",
        "description": "Muscular confident Doge compared to sad, weak Cheems",
        "use_case": "comparison, strength vs weakness, competence gaps, then vs now",
        "keywords": ["strong", "weak", "comparison", "then", "now", "competence", "ability"],
        "emotional_triggers": ["comparison", "nostalgia", "decline", "strength"],
        "visual_structure": "Two panels or side-by-side comparison of contrasting dogs",
        "layout_requirements": "LEFT/TOP: muscular, confident Doge, RIGHT/BOTTOM: sad, weak Cheems, showing clear contrast",
        "template_format": "comparison_contrast",
        "ideal_for": "comparing strength vs weakness, competence gaps, then vs now scenarios",
        "meme_strength": 85
    },
    {
        "name": "Roll Safe",
        "description": "Man tapping temple indicating 'smart' but flawed logic",
        "use_case": "flawed logic, ironic smartness, bad advice, think about it",
        "keywords": ["smart", "think", "logic", "clever", "brain", "idea", "wisdom"],
        "emotional_triggers": ["confidence", "smugness", "irony", "cleverness"],
        "visual_structure": "Single panel showing man tapping temple",
        "layout_requirements": "Man with knowing smile tapping temple with finger, indicating 'smart' thinking",
        "template_format": "single_wisdom",
        "ideal_for": "flawed logic, ironic smartness, bad advice, think about it moments",
        "meme_strength": 86
    }
]
