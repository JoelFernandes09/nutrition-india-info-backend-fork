const express    = require('express');
const rateLimit  = require('express-rate-limit');
const cors       = require('cors');
const helmet     = require('helmet');
const middleware = require('./utils/middleware');
const auth       = require('./utils/middleware').authHandler;
const requestIp  = require('request-ip');

require('dotenv').config();

const api     = require('./routes/api/api');
const aiRoute = require('./routes/ai/aiRoute');
const debugRoutes = require('./routes/debug.routes');

const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(requestIp.mw());

app.use('/ai', aiRoute);

app.use(middleware.authHandler);

const limiter = rateLimit({
  windowMs: 15 * 1000 * 60,
  max: 1000,
  message: {
    code: 429,
    message: 'Too many requests, please try after sometime',
  },
});

app.use(limiter);
app.use(helmet());
app.use('/v1', api);
app.use('/debug', debugRoutes);

app.use(middleware.errorHandler);

const PORT = 5000;
const port = process.env.PORT || PORT;

app.listen(port, () => console.log(`Server Running On PORT ${port}`));
