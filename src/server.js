const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const query_string = require('querystring');
const express = require('express');
const handlebars = require('express-handlebars');
const path = require('path');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const request = require('request-promise');
const session = require('express-session');
const { Router } = require('express');

// loading env vars from .env file
require('dotenv').config();

const nonceCookie = 'auth0rization-nonce';
let oidcProviderInfo;

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser(crypto.randomBytes(16).toString('hex')));
app.use(
  session({
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false
  })
);
app.engine('handlebars', handlebars());
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/profile', (req, res) => {
  const { accessToken } = req.session;
  //console.log('decodeIdToken', decodedIdToken);
  res.render('profile', {
    accessToken
  });
});

app.get('/login', async (req, res) => {
  const grant_type = 'client_credentials';
  const clientID = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const audience = process.env.API_IDENTIFIER;
  const data = {
    grant_type: grant_type,
    client_id: clientID,
    client_secret: clientSecret,
    audience: audience
  };

  try {
    const response = await request.post(
      `https://${process.env.OIDC_PROVIDER}/oauth/token`,
      { form: data }
    );
    const tokens = JSON.parse(response);
    req.session.accessToken = tokens.access_token;
    //console.log('access_token', req.session.accessToken);
    res.redirect('/profile');
  } catch (error) {
    console.log(error);
  }
});

app.get('/to-dos', async (req, res) => {
  const delegatedRequestOptions = {
    url: `http://localhost:3001`,
    headers: {
      Authorization: `Bearer ${req.session.accessToken}`
    }
  };
  // console.log('accessToken', req.session.accessToken);
  try {
    const delegatedResponse = await request(delegatedRequestOptions);
    const toDos = JSON.parse(delegatedResponse);

    res.render('to-dos', {
      toDos
    });
  } catch (error) {
    res.status(error.statusCode).send(error);
  }
});

app.get('/remove-to-do/:id', async (req, res) => {
  const deleteRequest = {
    url: `http://localhost:3001/${req.params.id}`,
    headers: {
      Authorization: `Bearer ${req.session.accessToken}`
    }
  };

  try {
    let response = await request.delete(deleteRequest);
    const toDos = JSON.parse(response);
    res.render('to-dos', {
      toDos
    });
  } catch (error) {
    res.status(error.statusCode).send(error);
  }
});

const { OIDC_PROVIDER } = process.env;
const discEnd = `https://${OIDC_PROVIDER}/.well-known/openid-configuration`;

//console.log('discEnd', discEnd);
request(discEnd)
  .then(res => {
    oidcProviderInfo = JSON.parse(res);
    app.listen(3000, () => {
      console.log(`Server running on http://localhost:3000`);
    });
  })
  .catch(error => {
    console.error(error);
    console.error(`Unable to get OIDC endpoints for ${OIDC_PROVIDER}`);
    process.exit(1);
  });
