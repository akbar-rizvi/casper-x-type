
import customers from "razorpay/dist/types/customers";
import {  z } from "zod";


export class payment{

    static razorpayment = z.object({
        body: z.object({
          amount: z.string({required_error: "code is required"})
        }).strict(),
        params: z.object({}).strict(),
        query: z.object({}).strict({message:"query is not required"}),
      }).strict();

      static cashfreePayment = z.object({
        body: z.object({
          amount: z.string({required_error: "code is required"}),
          customerPhone: z.string({required_error: "customerPhone is required"})
        }).strict(),
        params: z.object({}).strict(),
        query: z.object({}).strict({message:"query is not required"}),
      }).strict();
      
      static statusCheckCashfree = z.object({
        body: z.object({
        }).strict(),
        params: z.object({
            orderId: z.string({required_error: "code is required"}),
        }).strict(),
        query: z.object({}).strict({message:"query is not required"}),
      }).strict();
}