import fs from 'fs/promises';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import fetch from 'node-fetch';
import { IMAGE_QUALITY_OPTIONS } from '../utils/data';

const TEMP_DIR = path.resolve(__dirname, '../temp');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export async function generateCharacterImage(
  characterPrompt: string,
  artStyle: string,
  imageQuality: string = 'basic'
): Promise<{
  localPath: string | null;
  cloudinaryUrl: string | null;
  uploadResult: Record<string, any> | null;
}> {
  if (!(imageQuality in IMAGE_QUALITY_OPTIONS)) {
    imageQuality = 'basic';
  }

  const qualityConfig = IMAGE_QUALITY_OPTIONS[imageQuality];
  const timestamp = Date.now().toString();
  const tempFilename = path.join(TEMP_DIR, `character_${timestamp}.png`);

  const prompt = `
Create a character perfect for social media meme content: ${characterPrompt}

Art Style: ${artStyle}

Requirements:
- High quality and detailed artwork
- Clear, well-defined character features
- Expressive face suitable for various emotions and meme expressions
- Professional composition and lighting
- Character should be the main focus with consistency of details
- Background should be simple or easily removable for meme templates
- Perfect execution of the specified art style
- Character should be versatile for different meme scenarios
- TEXT on the image - pure character artwork

Character: ${characterPrompt}
Style: ${artStyle}
`.trim();

  try {
    console.log('🎨 Sending request to OpenAI...');
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3', // use this for compatibility
        prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      }),
    });

    const result = await response.json();
    console.log('📦 OpenAI API Response:', JSON.stringify(result, null, 2));
    console.log('📡 Response Status:', response.status);

    if (!response.ok || !result.data?.[0]?.b64_json) {
      console.error('❌ OpenAI API Error:', result);
      return {
        localPath: null,
        cloudinaryUrl: null,
        uploadResult: null,
      };
    }

    const imageBase64 = result.data[0].b64_json;
    const imageBytes = Buffer.from(imageBase64, 'base64');

    await fs.mkdir(TEMP_DIR, { recursive: true });
    await fs.writeFile(
      tempFilename,
      new Uint8Array(imageBytes.buffer, imageBytes.byteOffset, imageBytes.byteLength)
    );
    console.log('✅ Image saved to:', tempFilename);

    const uploadResult = await cloudinary.uploader.upload(tempFilename, {
      folder: 'character_images',
    });

    await fs.unlink(tempFilename);

    console.log('☁️ Cloudinary Upload Success:', uploadResult.secure_url);

    return {
      localPath: tempFilename,
      cloudinaryUrl: uploadResult.secure_url,
      uploadResult,
    };
  } catch (error: any) {
    console.error('❌ Image generation or upload failed:', error.message);
    console.error(error.stack);
    return {
      localPath: null,
      cloudinaryUrl: null,
      uploadResult: null,
    };
  }
}
