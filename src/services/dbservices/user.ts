import {and, desc, eq, inArray, sql} from "drizzle-orm";
import postgreDb from "../../config/db";

import { generateAuthTokens } from "../../config/token";
import { users } from "../../models/schema";

export class User {

  static saveDetails:any = async(userId:any,appId:any,deviceId:any):Promise<any>=>{
    try{
        const result =  await postgreDb.insert(users).values({
            userId:userId,
            appId:appId,
            deviceId:deviceId
        }).returning({userId:users.userId})
        return result
    }catch(error:any){
        throw new Error(error)
    }
  }

 
}