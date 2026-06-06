const express = require('express');
const cors = require('cors');
const app = express();



app.get('/',(req,res) =>{
    res.send("server is running").status(200);
});
app.use(cors());
app.use(express.json());

let port = process.env.PORT || 5000;

app.listen(port,() =>{
    console.log(`Server is running on port ${port}`);
})