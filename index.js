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
    try {
        const result = await hubspotClient.crm.schemas.coreApi.getById('p_quote_requests');
        options = extractFormOptions(result);
    }
    catch (error) {
        console.error('Error rendering quote form:', error);
    }

    res.render('quote-form', {
        title: 'Quote Request | HubSpot CRM Integration',
        options: options
    });
});

app.post('/submit-quote', async (req, res) => {
    const { firstName, lastName, email, size, stories, additionalInfo, location } = req.body;
    try {
        const existingContact = await getContactByEmail(email);

        const quoteRequestProperties = {
            stories: stories,
            size: size,
            details: additionalInfo,
            location: location,
            quote_request: "Quote request",
        };

        if (existingContact?.results?.length > 0) {
            const quoteRequest = await hubspotClient.crm.objects.basicApi.create('p_quote_requests', {
                properties: {
                    ...quoteRequestProperties
                },
            });
            console.log('Created quote request:', quoteRequest.id);
            console.log('Existing contact ID:', existingContact.results[0].id);
            await hubspotClient.crm.associations.v4.basicApi.create(
                'contacts',
                existingContact?.results[0].id,
                'p_quote_requests',
                quoteRequest?.id,
                [
                    {

                        associationCategory: 'USER_DEFINED',
                        associationTypeId: 36
                    }
                ]
            );
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
            const quoteRequest = await hubspotClient.crm.objects.basicApi.create('p_quote_requests', {
                properties: {
                    ...quoteRequestProperties
                },
            });

            await hubspotClient.crm.associations.v4.basicApi.create(
                'contacts',
                newContact?.id,
                'p_quote_requests',
                quoteRequest?.id,
                [
                    {
                        associationCategory: 'USER_DEFINED',
                        associationTypeId: 36
                    }
                ]
            );
        }

    } catch (error) {
        console.error('Error submitting quote request:', error);
        res.status(500).send('Error submitting quote request');
    }

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

            // In order to send confirmation email via workflow, we need to set the contact to "marketing"
            // This should only be done if the contact explicitly opts in to marketing communications
            await hubspotClient.crm.contacts.basicApi.update(existingContact.results[0].id, contactFormSubmittedAt());
            res.redirect('/');
        }
        else {
            // In order to send confirmation email via workflow, we need to set the contact to "marketing"
            // This should only be done if the contact explicitly opts in to marketing communications
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

const getContactByEmail = async (email) => {
    return await hubspotClient.crm.contacts.searchApi.doSearch({
        filterGroups: [{
            filters: [
                { propertyName: 'email', operator: 'EQ', value: email }
            ]
        }],
    });
};

/**
 * Extracts form options from HubSpot schema properties
 * @param {Object} schema - The HubSpot schema object
 * @returns {Object} Object containing mapped options for size, stories, and location
 */
function extractFormOptions(schema) {
    const sizeProperty = schema.properties.find(prop => prop.label === 'Size');
    const storiesProperty = schema.properties.find(prop => prop.label === 'Stories');
    const locationProperty = schema.properties.find(prop => prop.label === 'Location');

    // Map options to include both value and label for the dropdowns
    const sizeOptions = sizeProperty && sizeProperty.options ?
        sizeProperty.options.map(option => ({
            value: option.value,
            label: option.label
        })) : [];

    const storiesOptions = storiesProperty && storiesProperty.options ?
        storiesProperty.options.map(option => ({
            value: option.value,
            label: option.label
        })) : [];

    const locationOptions = locationProperty && locationProperty.options ?
        locationProperty.options.map(option => ({
            value: option.value,
            label: option.label
        })) : [];

    return {
        size: sizeOptions,
        stories: storiesOptions,
        location: locationOptions
    };
}

// Start the server
app.listen(3000, () => console.log('Listening on http://localhost:3000'));