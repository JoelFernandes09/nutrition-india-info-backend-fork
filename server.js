const express = require('express');
require('dotenv').config();
const  cors = require('cors')

const api = require('./routes/api/api');

const app = express();

app.use(cors())
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use("/api/v1", api );

// PORTs
const PORT = 5000;
const port = process.env.PORT || PORT;

// Spin Up API Server to PORT number
app.listen(port, () => console.log(`Server Running On PORT ${port}`));

