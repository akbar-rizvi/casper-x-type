import { Request, Response } from "express";
import {v4 as uuid} from "uuid"
import { isIndianLocation } from "../helper/helper";
import { generateTweetOnly } from "../helper/generateTweetOnly";
import {  ContentGenerator } from "../helper/generatetTweetWithExistingCharacter";
import { ART_STYLES, ENHANCED_MEME_TEMPLATES } from "../utils/data";
import {  generateCharacterImage } from "../helper/generateCharacter";



interface authenticateUser extends Request {
  user: any;
  body: any;
  file?: any;
}

type PipelineType="simple"|"meme"
// type MemeStyle="Indian" | "Global"

type artStyle="photorealistic" | "anime" | "pixar" | "oil_painting" | "comic"
type imageQuality="basic" | "advanced" 


export class User {
  static generateId = () => Math.random().toString(36).substr(2, 8).toUpperCase();

  static testRoute:any = async(req:Request,res:Response)=>{
    try{
      return res.status(200).json({message:"Api is Running...",status:true})
    }catch(error){
      return res.status(500).json({message:"Api Giving Error",status:false})
    }
  }


  // -----------meme style-----------------

  static generateTweet:any=async(req:authenticateUser,res:Response)=>{

     try {
      let { pipelineType, location ,raw_thoughts,previous_content} = req.body;
    
      

      if (!pipelineType) {
        return res.status(400).json({
          message: "Please provide pipelineType ",
          status: false,
        });
      }
     

     
      const validPipelineTypes: PipelineType[] = ["simple","meme"]
        
      
     

      if (!validPipelineTypes.includes(pipelineType)) {
        return res.status(400).json({
          message: `Invalid pipelineType. Must be one of: ${validPipelineTypes.join(", ")}`,
          status: false,
        });
      }

    

      const pipeline: PipelineType = pipelineType;

      //if no location is provided default will be global

      let style=null
      if(!location){
        style="Global"
        
      }else{
         style = isIndianLocation(location.lat,location.lon) ? "Indian" : "Global";

      }
      

     const uniqueId = uuid();

  const response = await generateTweetOnly(uniqueId, raw_thoughts, previous_content, pipelineType)

      return res.status(200).json({status: true,sessionId:uniqueId,style,data:"response"});

    } catch (error) {
      console.error("Error in memetype:", error);
      return res.status(500).json({ message: "Internal server error", status: false });
    }
  }


  //-------------generateTweet------------------------------

  static generateTweetWithExistingCharacter:any=async(req:authenticateUser,res:Response):Promise<any>=>{
    try {


      //---convert all to lowercase
      Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === "string") {
        req.body[key] = req.body[key].toLowerCase();
      }
    });



      const { raw_thoughts,art_style ,pipeline_type,image_quality="basic",previous_content } = req.body;
      
    // check for non empty
      if(!raw_thoughts || !art_style || !pipeline_type || !req.file){
        return res.status(400).json({ message: "All fields are required", status: false });
      }

    // check for valid values  
    const validArtStyles: string[] = ["photorealistic", "anime", "pixar", "oil_painting", "comic"];
    const validPipelineTypes: string[] = ["simple", "meme"];
    const validImageQualities: string[] = ["basic", "advanced"];

   if (!validArtStyles.includes(art_style)) {
  return res.status(400).json({
    message: `Invalid art_style: '${art_style}'. Allowed values are: ${validArtStyles.join(", ")}`,
    status: false,
  });
}

if (!validPipelineTypes.includes(pipeline_type)) {
  return res.status(400).json({
    message: `Invalid pipeline_type: '${pipeline_type}'. Allowed values are: ${validPipelineTypes.join(", ")}`,
    status: false,
  });
}

if (!validImageQualities.includes(image_quality)) {
  return res.status(400).json({
    message: `Invalid image_quality: '${image_quality}'. Allowed values are: ${validImageQualities.join(", ")}`,
    status: false,
  });
} 
console.log("path",req.file.path);

// calling here as a helper function
let session_id=uuid()

const contentGenerator=new ContentGenerator(session_id)

const tweet_result = await contentGenerator.generate_tweet_complete(
      raw_thoughts,
      previous_content || null,
      pipeline_type,
      session_id
     
    );

    if ("error" in tweet_result) {
      return res.status(500).json({
        success: false,
        message: tweet_result.error,
        session_id
      });
    }

     const character_url = await contentGenerator.upload_to_cloudinary(req.file.path);
    if (!character_url) {
      return res.status(500).json({
        success: false,
        message: "Failed to upload character image",
        session_id
      });
    }
      const character_data = {
          character_image_url: character_url,
          art_style: ART_STYLES[art_style],
          source: "existing_image"
        };


        console.log('test chardata',character_data)

    contentGenerator.session_data.character_image_url = character_url;

          
    const action_image_url = await contentGenerator.generate_action_image(
      tweet_result.best_tweet,
      character_data,
      req.file.path,
      image_quality
    ); 

      if (action_image_url) {
      contentGenerator.session_data.action_image_url = action_image_url;
    }
    
    // Save session data
    const json_url = await contentGenerator.upload_json_to_cloudinary(contentGenerator.session_data, "complete_session");
    
    // Clean up temp files
    contentGenerator.cleanup_local_files();


     return res.status(200).json({
      success: true,
      message: "Tweet and action image generated with enhanced meme template matching",
      session_id,
      data: {
        tweet: tweet_result.best_tweet,
        approach: tweet_result.approach,
        metadata: tweet_result.metadata,
        meme_template: tweet_result.meme_template,
        character_image_url: character_url,
        action_image_url,
        image_quality,
        session_data_url: json_url,
        cloudinary_urls: contentGenerator.session_data.cloudinary_urls,
        token_usage: contentGenerator.session_data.token_usage
      }
    });


     

    } catch (e) {
    console.error("Error in generateTweetWithExistingCharacter:", e);
     console.error(`Tweet with existing character failed: ${e}`);
    console.error(`Traceback: ${e instanceof Error ? e.stack : e}`);
    return res.status(500).json({
      success: false,
      message: String(e),
      session_id: req.body.session_id
    });
    }
  }


  static  generateTweetWithNewCharacterController = async (req: Request, res: Response): Promise<any> => {
  const {
  
    raw_thoughts,
    previous_content,
    character_prompt,
    art_style,
    pipeline_type,
    image_quality
  } = req.body;

  
  if (!raw_thoughts || !character_prompt || !art_style || !pipeline_type) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    });
  }

  const session_id=uuid()
  
 const contentGenerator=new ContentGenerator(session_id)

const tweet_result = await contentGenerator.generate_tweet_complete(
      raw_thoughts,
      previous_content || null,
      pipeline_type,
      session_id
     
    );

    if ("error" in tweet_result) {
      return res.status(500).json({
        success: false,
        message: tweet_result.error,
        session_id
      });
    }


  try {
    console.log('test',character_prompt,art_style,image_quality)
    const characterGenerator = await generateCharacterImage(character_prompt, art_style, image_quality);

    if (!characterGenerator) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate character image",
        session_id
      });
    }

    const character_data = {
      character_image_url: characterGenerator.cloudinaryUrl,
     
      art_style: ART_STYLES[art_style],
      
    };

    console.log('test chardata',characterGenerator)

    return res.status(200).json({
      success: true,
      message: "Tweet and action image generated with new character",
      session_id,
      data: {
        tweet: tweet_result.best_tweet,
        approach: tweet_result.approach,
        metadata: tweet_result.metadata,
        meme_template: tweet_result.meme_template,
        character_image_url: characterGenerator.cloudinaryUrl,
        requires_approval:true,
        image_quality,
        character_data
        
        
        
      }
      
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: (error as Error).message,
     
    });
  }
};

  static characterApproval = async (req: authenticateUser, res: Response): Promise<any> => {
    const { character_image_url, session_id } = req.body;
    console.log("data",req.body)
    return res.send('ok')
 

  }






  //-------------------------get templates-----------------------------------//
  static getTemplates = async (req: authenticateUser, res: Response): Promise<any> => {
    return res.send(ENHANCED_MEME_TEMPLATES)
    
  }

}