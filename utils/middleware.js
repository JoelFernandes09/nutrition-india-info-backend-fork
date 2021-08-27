const logger = require('./logger');
const CryptoJS = require('crypto-js');

const errorHandler = (error, request, response, next) => {
  logger.error(error.message);

  if (error.name === 'CastError') {
    return response.status(400).send({ error: 'malformatted id' });
  } else if (error.name === 'ValidationError') {
    return response.status(400).json({ error: error.message });
  } else if (error.name === 'TypeError') {
    return response.status(400).json({ error: 'Unauthorized Access!!' });
  }

  next(error);
};

const authHandler = (req, res, next) => {
  try {
    const token = req.get('Authorization');
    const bytes = CryptoJS.AES.decrypt(token, process.env.KEY);
    const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    if (decryptedData !== process.env.SECRET_DATA) {
      throw 'invalid access';
    } else {
      next();
    }
  } catch (err) {
    res.status(401).send({error: 'Invalid request'})
  }
};

module.exports = { errorHandler, authHandler };
