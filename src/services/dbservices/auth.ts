import postgreDb from "../../config/db";
import { eq  } from "drizzle-orm"

import { bcryptPassword, validatePassword } from "../../config/passwordHash";
import { generateAuthTokens } from "../../config/token";
import { users } from "../../models/schema";


export class auth{

    static generateId = () => Math.random().toString(36).substr(2, 8).toUpperCase();

    static insertUser = async(details:any,tx:any,fromGoogle:boolean)=>{
        try {
          return await tx.insert(users)
          .values({
            userId: this.generateId(),
            name: details.name,
            email: details.email,
            password: fromGoogle ? null : await bcryptPassword(details.password),
          })
          .onConflictDoNothing({ target: users.email })
          .returning({
            id: users.id,
            userid: users.userId,
            name: users.name,
            email: users.email,
          });
        } catch (error) {
          throw new Error(error);
        }
      }

    static userDetails = async (users: any) => {
        const Token=generateAuthTokens(users.id)
        return {
          userid: users.userId,
          name: users.name,
          email: users.email,
          token:Token
        }
      }
   
      static register=async(details:any,fromGoogle:boolean):Promise<any>=>{
        try {
          return await postgreDb.transaction(async (tx) => {
            const registerUser= await this.insertUser(details,tx,fromGoogle)
            if(registerUser.length<=0) throw new Error("User already exists");
            return this.userDetails(registerUser[0])
          });
        } catch (error) {
          throw new Error(error)
        }
    
      }

    static login = async(details:any,fromGoogle:boolean):Promise<any>=>{
        try{
              const findUser = await postgreDb.select({
                userId: users.id,
                name: users.name,
                email: users.email,
                password: users.password
              }).from(users).where(eq(users.email, details.email));
        if (findUser){
            if(fromGoogle){
              return this.userDetails(findUser)
            }else{
              const hashPassword=await validatePassword(details.password,findUser[0].password)
              if (hashPassword) return this.userDetails(findUser)
              else throw new Error("Enter Valid Password")
            }
          }
          else{
            if(fromGoogle) return null;
            throw new Error("Please enter valid Email") 
          } 
        }catch(error){
          throw new Error(error.message)
        }
      }

          
      
      
      
      
     

      

      

       
  }