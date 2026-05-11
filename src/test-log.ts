console.log('--- TEST START ---');
import dotenv from 'dotenv';
console.log('Dotenv imported');
dotenv.config();
console.log('Env loaded:', process.env.DISCORD_TOKEN ? 'FOUND' : 'NOT FOUND');
console.log('--- TEST END ---');