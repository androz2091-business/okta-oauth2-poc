import dotenv from 'dotenv'
dotenv.config({
	path: '.env.prod'
});

import express from 'express';
import qs from 'querystring';
import pkceChallenge from 'pkce-challenge';
import session from 'express-session';

const { OKTA_DOMAIN, CLIENT_ID, REDIRECT_URI, PORT } = process.env;

const app = express();

app.use(session({
  secret: 'meerkat'
}));

app.get('/login', async (req, res) => {

	const { code_verifier, code_challenge } = await pkceChallenge();  

	req.session.code_verifier = code_verifier;

	const params = qs.stringify({
		client_id: CLIENT_ID,
		response_type: 'code',
		scope: 'openid profile email',
		redirect_uri: REDIRECT_URI,
		code_challenge,
		code_challenge_method: 'S256',
		state: 'meerkat' // peu importe, qqch de random
	});
	res.redirect(`https://${OKTA_DOMAIN}/oauth2/v1/authorize?${params}`);  // pourquoi il y a pas le `/default` dans l'URL ?
});

app.get('/okta/redirect', async (req, res) => {
	const { code, state } = req.query;
	
	if (state !== 'meerkat') 
    	return res.status(400).send('Invalid state');

	const codeVerifier = req.session.code_verifier;
	if (!codeVerifier)
		return res.status(400).send('Code verifier not found in session');

	const tokenResponse = await fetch(`https://${OKTA_DOMAIN}/oauth2/v1/token`, {
		method: 'POST',	
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: qs.stringify({
			grant_type: 'authorization_code',
			client_id: CLIENT_ID,
			client_secret: process.env.CLIENT_SECRET,
			redirect_uri: REDIRECT_URI,
			code: code,
			code_verifier: codeVerifier
		})
	});
	const tokens = await tokenResponse.json();

	console.log('Tokens:', tokens);

	const data = await fetch(`https://${OKTA_DOMAIN}/oauth2/v1/userinfo`, {
		headers: {
			'Authorization': `Bearer ${tokens.access_token}`
		}
	});
	const userInfo = await data.json();

	res.send('Top, ton email est ' + userInfo.email + '<br /><br /><img src="https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcQQiAiBTa_bEJvz1r2e64PEGAw3qvXsFJ4jIbqB0kuXXeF2vo9TPhqz8_DRWfD7fIPlduEWjAv2e6vnBKXt0UPJ8w" />');
});

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
	console.log(`Login URL: http://localhost:${PORT}/login`);
	console.log(`Redirect URL: http://localhost:${PORT}/okta/redirect`);
});
