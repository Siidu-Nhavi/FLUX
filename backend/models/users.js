import {mongoose} from "mongoose";

const userSchema = new Schema({
    name:{type:String, required:true},
    userName:{type:String, required:true,unique:true},
    password:{type:String, required:true,unique:true},
    token:{type:String, required:true},
});

const User = mongoose.model("User", userSchema);

export {User}; // can help to import the model in other files and use it to interact with the users collection in the database.