 const express = require('express');
const cors = require('cors');
const AfricasTalking = require('africastalking');

// Create an Express app
const app = express();

// Allow all CORS requests
app.use(cors());

// Use JSON middleware to parse request body
app.use(express.json());

// Define a route to handle incoming SMS requests
app.post('/send-sms', (req, res) => {
    // check if at least one number is added in the array of recipients to receive messages
 if(req.body.recipients.length === 0) res.status(403).json({ error: 'At least one number is required to send sms' }); // Respond with an error message
    // Check if API key and username are provided in options, use default credentials if not
    const credentials = {
        apiKey: req.body.apiKey,
        username: req.body.username,
    }

    // Initialize the SDK with the provided credentials, this authenticates our client with Africastaking
    const africasTalking = AfricasTalking(credentials);
    // Get the SMS service
    const sms = africasTalking.SMS;
    const smsBody = {
        // Set the numbers you want to send to in international format
        to: req.body.recipients,
        // Set your message
        message: req.body.message,
        // Set your shortCode or senderId
        from: req.body.from
    }
    // Send SMS using options from the request body
    sms.send(smsBody)
        .then(response => {
            console.log(response); // Log the response
            res.status(200).json(response); // Respond with the response from the API gateway
        })
        .catch(error => {
            console.error(error); // Log any errors
            res.status(500).json({ error: 'An error occurred while sending SMS' }); // Respond with an error message
        });
});

// Start the Express server
const port = 3006;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

