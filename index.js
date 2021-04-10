const express = require('express');
const port = 3000;
const app = express();
const fs = require('fs');
const path = require('path');


app.use(express.static(__dirname + '/public'));


app.listen(port, ()=> console.log('initialized on port 3000'));