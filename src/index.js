require('dotenv').config();
const express = require('express');
const { createClient } = require('redis');
const { Sequelize, DataTypes } = require('sequelize');
const shortid = require('shortid');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

const redisClient = createClient({ url: process.env.REDIS_URL });
const sequelize = new Sequelize(process.env.DATABASE_URL);

redisClient.connect()
  .then(() => console.log('Connected to Redis'))
  .catch(err => console.error('Redis connection error: ', err));

sequelize.authenticate()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('PostgreSQL connection error: ', err));

const Urls = sequelize.define('Urls', {
  shortId: { type: DataTypes.STRING, primaryKey: true },
  originalUrl: { type: DataTypes.TEXT, allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'urls',
});

sequelize.sync({ alter: true });

app.post('/urls', async (req, res) => {
  try {
    const { url, customAlias, expirationMinutes } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    let shortId = customAlias || shortid.generate();
    if (customAlias) {
      // check if customAlias is already taken
      const temp = await Urls.findByPk(customAlias);
      if (temp) {
        return res.status(409).json({ error: 'Custom alias is already in use'});
      }
    }
        
    const expiresAt = expirationMinutes ? new Date(Date.now() + expirationMinutes * 60000) : null;
    
    await Urls.create({ shortId, originalUrl: url, expiresAt });
    
    const ttlInSeconds = expiresAt ? Math.floor((expiresAt - Date.now()) / 1000) : null;

    // set Redis with expiration if provided
    if (ttlInSeconds) {
      await redisClient.setEx(shortId, ttlInSeconds, url);
    } else {
      await redisClient.set(shortId, url);
    }
    
    const shortUrl = `${req.protocol}://${req.get('host')}/${shortId}`;
    res.status(201).json({ shortUrl });

  } catch (error) {
    console.error('Error creating URL:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/:shortId', async (req, res) => {
  try {
    const { shortId } = req.params;
  
    let originalUrl = await redisClient.get(shortId);
  
    if (originalUrl) {
      return res.redirect(originalUrl);
    }
  
    const record = await Urls.findByPk(shortId);
    if (record) {
      // check if URL has expired
      if (record.expiresAt && Date.now() >  record.expiresAt.getTime()) {
        return res.status(410).send('URL has expired');
      }

      originalUrl = record.originalUrl;

      const ttlInSeconds = record.expiresAt ? Math.floor((record.expiresAt - Date.now()) / 1000) : null;
      if (ttlInSeconds) {
        await redisClient.setEx(shortId, ttlInSeconds, originalUrl);
      } else {
        await redisClient.set(shortId, originalUrl);
      }
      return res.redirect(originalUrl);
    }
  
    res.status(404).send('URL not found');
  } catch (error) {
    console.error('Error fetching URL:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/', (req, res) => {
  res.send('Welcome to Url Shortner');
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));