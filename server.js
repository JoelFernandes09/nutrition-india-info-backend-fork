const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const helmet = require('helmet')
const middleware = require('./utils/middleware')
const auth = require('./utils/middleware').authHandler

require('dotenv').config();

const api = require('./routes/api/api');

const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(middleware.authHandler)

const limiter = rateLimit({
  windowMs: 15 * 1000 * 60, // 15 minutes
  max: 1000, // limit each IP to 200 requests per windowMs
  message: {
      code: 429,
      message: "Too many requests, plase try after sometime"
  }
});

//  apply to all requests
app.use(limiter);
// app.disable('x-powered-by')
app.use(helmet())
app.use('/v1', api);


app.use(middleware.errorHandler)

// PORTs
const PORT = 5000;
const port = process.env.PORT || PORT;

// Spin Up API Server to PORT number
app.listen(port, () => console.log(`Server Running On PORT ${port}`));
