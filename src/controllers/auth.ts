import {Request,Response} from "express"
import { envConfigs } from "../config/envconfig";
import axios from "axios";
import dbservices from "../services/dbservices";
import url from "node:url";





export class auth{

    static googleSignInSignUp =  async(req:Request,res:Response)=>{
        try {
          const token = req.query.code;
          let clientId = envConfigs.googleClientId;
          let clientSecret = envConfigs.googleClientSecret;
          let REDIRECT_URI = envConfigs.redirectUri;
          const validateUser = await axios.post(`https://oauth2.googleapis.com/token`,{code:token,client_id: clientId,client_secret: clientSecret,redirect_uri:REDIRECT_URI,grant_type: "authorization_code"});
          const { id_token, access_token } = validateUser.data;
          const {email,name,picture} = await axios
          .get(
            `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`,
            {
              headers: {
                Authorization: `Bearer ${id_token}`,
              },
            }
          )
          .then((res) => res.data)
          .catch((error) => {
            console.error(`Failed to fetch user`);
            throw new Error(error.message);
          });
          if(!email) throw new Error("Error fetching email please try again");
  
  
          let userExists = await dbservices.auth.login({email},true);
          if (!userExists) {
            const createBody = {
                email: email,
                name: name,
                avatar:picture,
            };
            userExists=await dbservices.auth.register(createBody,true); 
          }
          let FRONTEND_REDIRECT_URL = envConfigs.frontendRedirectUrlLocal;
  
          return res.redirect(url.format({
            pathname:`${FRONTEND_REDIRECT_URL}`,
            query:{user:JSON.stringify(userExists)}
          }));
        } catch (error) {
          console.log(error);
          // return res.redirect(url.format({
          //   pathname:`${FRONTEND_REDIRECT_URL}`,
          //   query:{
          //     error_message:error["message"]
          //   }
          // }));
        }
      }

      
}