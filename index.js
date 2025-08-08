require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();

// Set view engine to pug
app.set('view engine', 'pug');

// Serve static files from public directory
app.use(express.static(__dirname + '/public'));

// Parse URL-encoded bodies and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Environment variable for HubSpot access token
const PRIVATE_APP_ACCESS = process.env.PRIVATE_APP_ACCESS;

// Routes will be added here
app.get('/', (req, res) => {
  res.render('contact-form', { title: 'Contact Form | HubSpot CRM Integration' });
});

// Start the server
app.listen(3000, () => console.log('Listening on http://localhost:3000'));