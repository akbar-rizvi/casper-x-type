import express from "express"
const router=express.Router()
import controllers from "../controllers";
import { authenticateUser } from "../middleware";


import { multerHandler, uploadImage } from "../helper/multer";


router.get('/test',controllers.User.testRoute);

router.post('/generate-tweet',controllers.User.generateTweet);

router.post('/generate-tweet-existing-character',multerHandler(uploadImage.single('image')),controllers.User.generateTweetWithExistingCharacter);

router.post('/generate-tweet-with-new-character', controllers.User.generateTweetWithNewCharacterController);

router.post('/character-approval',controllers.User.characterApproval);






router.get('/get-template',controllers.User.getTemplates);
router.get('/image-quality-info',controllers.User.imageQualityInfo)

export default router