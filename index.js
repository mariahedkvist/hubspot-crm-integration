require('dotenv').config();
const express = require('express');

const app = express();
app.set('view engine', 'pug');
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Environment variable for HubSpot access token
const PRIVATE_APP_ACCESS = process.env.PRIVATE_APP_ACCESS;
const ACCOUNT_ID = process.env.ACCOUNT_ID;

const BASE_URL = 'https://api.hubspot.com/crm/v3/';

const hubspot = require('@hubspot/api-client');
const hubspotClient = new hubspot.Client({ accessToken: PRIVATE_APP_ACCESS });

app.get('/', async (req, res) => {
    res.render('contact-form', { title: 'Contact Form | HubSpot CRM Integration' });
});

app.post('/submit-contact', async (req, res) => {
    const { firstName, lastName, email, message } = req.body;
    try {
        const existingContact = await hubspotClient.crm.contacts.searchApi.doSearch({
            filterGroups: [{
                filters: [
                    { propertyName: 'email', operator: 'EQ', value: email }
                ]
            }],
        });

        if (existingContact?.results?.length > 0) {
            const createdNote = await hubspotClient.crm.objects.notes.basicApi.create(createNoteInput(existingContact.results[0].id, message));
            if (!createdNote) {
                console.error('Failed to create note for existing contact');
                return res.status(500).send('Error creating note for existing contact');
            }

            await hubspotClient.crm.contacts.basicApi.update(existingContact.results[0].id, contactFormSubmittedAt());
            res.redirect('/');
        }
        else {
            const contactInput = {
                properties: {
                    firstname: firstName,
                    lastname: lastName,
                    email: email
                }
            };

            const newContact = await hubspotClient.crm.contacts.basicApi.create(contactInput);
            await hubspotClient.crm.objects.notes.basicApi.create(createNoteInput(newContact.id, message));
            res.redirect('/');
        }
    }
    catch (error) {
        console.error('Error submitting contact request:', error);
        res.status(500).send('Error submitting contact request');
    }
});

const contactFormSubmittedAt = () => {
    const properties = {
        contact_form_submitted_at: new Date().toISOString(),
    };
    return { properties };
};

const createNoteInput = (contactId, message) => {
    const noteProperties = {
        hs_note_body: `Contact requested: ${message}`,
        hs_timestamp: new Date().toISOString(),
    };

    const noteInput = {
        properties: noteProperties,
        associations: [
            {
                types: [
                    {
                        associationCategory: "HUBSPOT_DEFINED",
                        associationTypeId: 202 // Note to contact association type ID
                    }
                ],
                to: {
                    id: contactId
                }
            }
        ]
    };

    return noteInput;
};

// Start the server
app.listen(3000, () => console.log('Listening on http://localhost:3000'));