
import {  z } from "zod";
import { OtpVerificationMethods } from "../enums";


export class auth{

    static sanitizeInputString(input:string):string {
        return  input.replace(/[^a-zA-Z0-9_\s]/g, '');
      }

    static googleLogin = z.object({
        body: z.object({
          code: z.string({required_error: "code is required"})
        }).strict(),
        params: z.object({}).strict(),
        query: z.object({}).strict({message:"query is not required"}),
      }).strict();

      static whatsAppLogin = z.object({
        body: z.object({
          phone: z.string({required_error: "phone is required"}).min(8).max(12).refine(val=>parseInt(val)>0),
          countryCode: z.string({required_error: "countryCode is required"}).regex(/^\+\d{1,3}$/).min(2).max(4),
        }).strict(),
        params: z.object({
        }).strict(),
        query: z.object({}).strict(),
      }).strict();


      static verifyOtp = z.object({
        body: z.object({
          otp: z.string({required_error: "otp is required"}).regex(/^\d{6}$/,{message:"Invalid OTP Format"}).transform(val=>this.sanitizeInputString(val)),
          method: z.enum(Object.values(OtpVerificationMethods) as [string,...string[]],{invalid_type_error:"please provide a valid otp verification method",required_error:"otp verification method is required"})
        }).strict(),
        params: z.object({}).strict(),
        query: z.object({}).strict(),
      }).strict();

      static login = z.object({
        body: z.object({
          email: z.string({required_error: "email is required"}).email(),
        }).strict(),
        params: z.object({
        }).strict(),
        query: z.object({}).strict(),
      }).strict();

      static spotifyLogin = z.object({
        body: z.object({
          code: z.string({required_error: "code is required"})
        }).strict(),
        params: z.object({}).strict(),
        query: z.object({}).strict({message:"query is not required"}),
      }).strict();
}