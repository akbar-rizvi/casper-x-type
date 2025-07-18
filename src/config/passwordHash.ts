import bcrypt from "bcrypt"

const bcryptPassword=async(password:string)=>{
  try {
    return await bcrypt.hash(password, 10)
  } catch (error) {
    throw new Error(error)
  }
}

const validatePassword=async(password:string,hash:string)=>{
  try {
    return await bcrypt.compare(password, hash);
  } catch (err) {
    throw new Error('Error while validating password');
  }
}

export { bcryptPassword,validatePassword}