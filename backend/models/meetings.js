import {mongoose} from "mongoose";

const meetingSchema = new Schema({
    user_id:{type:string, required:true},
    meetingCode:{type:string, required:true},
    date: {type:Date, default:Date.now , required:true},
});

const Meeting = mongoose.model("Meeting", meetingSchema);
export {Meeting}; // can help to import the model in other files and use it to interact with the meetings collection in the database.