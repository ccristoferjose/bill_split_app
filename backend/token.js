const jwt = require('jsonwebtoken');

const accessSecret = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
const refreshSecret = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';


const userId = '123'; 
const accessToken = jwt.sign({ userId }, accessSecret, { expiresIn: '3m' });
const refreshToken = jwt.sign({ userId }, refreshSecret, { expiresIn: '7d' });

console.log('Access Token:', accessToken);
console.log('Refresh Token:', refreshToken);
