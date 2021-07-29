const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const helmet = require('helmet')

require('dotenv').config();

const api = require('./routes/api/api');

const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 1000 * 60, // 15 minutes
  max: 500, // limit each IP to 200 requests per windowMs
  message: {
      code: 429,
      message: "Too many requests, plase try after sometime"
  }
});

//  apply to all requests
app.use(limiter);
// app.disable('x-powered-by')
app.use(helmet())
app.use('/api/v1', api);

// PORTs
const PORT = 5000;
const port = process.env.PORT || PORT;

// Spin Up API Server to PORT number
app.listen(port, () => console.log(`Server Running On PORT ${port}`));
