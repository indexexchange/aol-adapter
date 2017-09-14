/**
 * @author:    Index Exchange
 * @license:   UNLICENSED
 *
 * @copyright: Copyright (C) 2017 by Index Exchange. All rights reserved.
 *
 * The information contained within this document is confidential, copyrighted
 *  and or a trade secret. No part of this document may be reproduced or
 * distributed in any form or by any means, in whole or in part, without the
 * prior written permission of Index Exchange.
 */
// jshint ignore: start

'use strict';

/* =====================================
 * Utilities
 * ---------------------------------- */

/**
 * Returns an array of parcels based on all of the xSlot/htSlot combinations defined
 * in the partnerConfig (simulates a session in which all of them were requested).
 *
 * @param {object} profile
 * @param {object} partnerConfig
 * @returns []
 */
function generateReturnParcels(profile, partnerConfig) {
    var returnParcels = [];

    for (var htSlotName in partnerConfig.mapping) {
        if (partnerConfig.mapping.hasOwnProperty(htSlotName)) {
            var xSlotsArray = partnerConfig.mapping[htSlotName];
            for (var i = 0; i < xSlotsArray.length; i++) {
                var xSlotName = xSlotsArray[i];
                returnParcels.push({
                    partnerId: profile.partnerId,
                    htSlot: {
                        getId: function () {
                            return htSlotName
                        }
                    },
                    ref: "",
                    xSlotRef: partnerConfig.xSlots[xSlotName],
                    requestId: '_' + Date.now()
                });
            }
        }
    }

    return returnParcels;
}

/* =====================================
 * Testing
 * ---------------------------------- */

describe('generateRequestObj', function () {

    /* Setup and Library Stub
     * ------------------------------------------------------------- */
    var inspector = require('schema-inspector');
    var proxyquire = require('proxyquire').noCallThru();
    var libraryStubData = require('./support/libraryStubData.js');
    var partnerModule = proxyquire('../aol-htb.js', libraryStubData);
    var oneDisplayConfigs = require('./support/mockPartnerConfig.json').oneDisplay;
    var expect = require('chai').expect;
    /* -------------------------------------------------------------------- */

    /* Partner instances */
    var partnerInstance;
    var partnerProfile;

    /* Generate dummy return parcels based on MRA partner profile */
    var returnParcels;
    var requestObject;

    describe('should return a correctly formated object', function () {

        /* Instatiate your partner module */
        partnerInstance = partnerModule(oneDisplayConfigs.na);
        partnerProfile = partnerInstance.__profile;

        /* Generate a request object using generated mock return parcels. */
        returnParcels = generateReturnParcels(partnerProfile, oneDisplayConfigs.na);

        for (var i = 0; i < returnParcels.length; i++) {
            requestObject = partnerInstance.__generateRequestObj([returnParcels[i]]);

            /* Simple type checking, should always pass */
            it('should contain the correct properties', function () {
                var result = inspector.validate({
                    type: 'object',
                    strict: true,
                    properties: {
                        url: {
                            type: 'string',
                            minLength: 1
                        },
                        callbackId: {
                            type: 'string',
                            minLength: 1
                        }
                    }
                }, requestObject);

                expect(result.valid).to.be.true;
            });
        }
    });

    /* Test that the generateRequestObj function creates the correct object by building a URL
     * from the results. This is the bid request url that wrapper will send out to get demand
     * for your module.
     *
     * The url should contain all the necessary parameters for all of the request parcels
     * passed into the function.
     */

    describe('should correctly build onedisplay endpoint url', function () {
        var url, i, match;

        it('should correctly set NA url', function () {
            /* Instatiate your partner module */
            partnerInstance = partnerModule(oneDisplayConfigs.na);
            partnerProfile = partnerInstance.__profile;

            /* Generate a request object using generated mock return parcels. */
            returnParcels = generateReturnParcels(partnerProfile, oneDisplayConfigs.na);

            for (i = 0; i < returnParcels.length; i++) {
                requestObject = partnerInstance.__generateRequestObj([returnParcels[i]]);
                url = requestObject.url;
                expect(url.match("adserver-us.adtech.advertising.com", "url is incorrect").length).to.equal(1);
            }
        })

        it('should correctly set EU url', function () {
            /* Instatiate your partner module */
            partnerInstance = partnerModule(oneDisplayConfigs.eu);
            partnerProfile = partnerInstance.__profile;

            /* Generate a request object using generated mock return parcels. */
            returnParcels = generateReturnParcels(partnerProfile, oneDisplayConfigs.eu);

            for (i = 0; i < returnParcels.length; i++) {
                requestObject = partnerInstance.__generateRequestObj([returnParcels[i]]);
                url = requestObject.url;
                expect(url.match("adserver-eu.adtech.advertising.com", "url is incorrect").length).to.equal(1);
            }
        })

        it('should correctly set ASIA url', function () {
            /* Instatiate your partner module */
            partnerInstance = partnerModule(oneDisplayConfigs.asia);
            partnerProfile = partnerInstance.__profile;

            /* Generate a request object using generated mock return parcels. */
            returnParcels = generateReturnParcels(partnerProfile, oneDisplayConfigs.asia);

            for (i = 0; i < returnParcels.length; i++) {
                requestObject = partnerInstance.__generateRequestObj([returnParcels[i]]);
                url = requestObject.url;
                expect(url.match("adserver-as.adtech.advertising.com").length, "url is incorrect").to.equal(1);
            }
        })

        it('should correctly set CMD request paramater', function () {
            /* Instatiate your partner module */
            partnerInstance = partnerModule(oneDisplayConfigs.na);
            partnerProfile = partnerInstance.__profile;

            /* Generate a request object using generated mock return parcels. */
            returnParcels = generateReturnParcels(partnerProfile, oneDisplayConfigs.na);

            for (i = 0; i < returnParcels.length; i++) {
                requestObject = partnerInstance.__generateRequestObj([returnParcels[i]]);
                url = requestObject.url;
                match = url.match(/;cmd=(.*?);/);
                expect(match[1], "cmd is incorrect or not present").to.equal('bid');
            }
        })

        it('should correctly set CORS request paramater', function () {
            /* Instatiate your partner module */
            partnerInstance = partnerModule(oneDisplayConfigs.na);
            partnerProfile = partnerInstance.__profile;

            /* Generate a request object using generated mock return parcels. */
            returnParcels = generateReturnParcels(partnerProfile, oneDisplayConfigs.na);

            for (i = 0; i < returnParcels.length; i++) {
                requestObject = partnerInstance.__generateRequestObj([returnParcels[i]]);
                url = requestObject.url;
                match = url.match(/;cors=(.*?);/);
                expect(match[1], "CORS is incorrect or not present").to.equal('yes');
            }
        })

        it('should correctly set V request paramater', function () {
            /* Instatiate your partner module */
            partnerInstance = partnerModule(oneDisplayConfigs.na);
            partnerProfile = partnerInstance.__profile;

            /* Generate a request object using generated mock return parcels. */
            returnParcels = generateReturnParcels(partnerProfile, oneDisplayConfigs.na);

            for (i = 0; i < returnParcels.length; i++) {
                requestObject = partnerInstance.__generateRequestObj([returnParcels[i]]);
                url = requestObject.url;
                match = url.match(/;v=(.*?);/);
                expect(match[1], "V is incorrect or not present").to.equal('2');
            }
        })

        it('should correctly set MISC request paramater', function () {
            /* Instatiate your partner module */
            partnerInstance = partnerModule(oneDisplayConfigs.na);
            partnerProfile = partnerInstance.__profile;

            /* Generate a request object using generated mock return parcels. */
            returnParcels = generateReturnParcels(partnerProfile, oneDisplayConfigs.na);

            for (i = 0; i < returnParcels.length; i++) {
                requestObject = partnerInstance.__generateRequestObj([returnParcels[i]]);
                url = requestObject.url;
                match = url.match(/;misc=(.*?);/);
                expect(match[1], "V is incorrect or not present").to.be.not.null;
            }
        })

        it('should correctly set unique callback request parameter for each request', function () {
            /* Instatiate your partner module */
            partnerInstance = partnerModule(oneDisplayConfigs.na);
            partnerProfile = partnerInstance.__profile;

            /* Generate a request object using generated mock return parcels. */
            returnParcels = generateReturnParcels(partnerProfile, oneDisplayConfigs.na);

            for (i = 0; i < returnParcels.length; i++) {
                requestObject = partnerInstance.__generateRequestObj([returnParcels[i]]);
                url = requestObject.url;
                match = url.match(/;callback=(.*?);/);
                expect(match[1], "callback function is incorrect").to.equal('window.headertag.' + partnerProfile.namespace + '.adResponseCallbacks.' + requestObject.callbackId);
            }
        })

        it('should correctly set networkId', function () {
            /* Instatiate your partner module */
            partnerInstance = partnerModule(oneDisplayConfigs.na);
            partnerProfile = partnerInstance.__profile;

            /* Generate a request object using generated mock return parcels. */
            returnParcels = generateReturnParcels(partnerProfile, oneDisplayConfigs.na);

            for (i = 0; i < returnParcels.length; i++) {
                requestObject = partnerInstance.__generateRequestObj([returnParcels[i]]);
                url = requestObject.url;
                expect(url.match("9959.1").length, "networkId is incorrect").to.equal(1);
            }
        })

        it('should correctly set placementId request parameter for each request/slot', function () {
            /* Instatiate your partner module */
            partnerInstance = partnerModule(oneDisplayConfigs.na);
            partnerProfile = partnerInstance.__profile;

            /* Generate a request object using generated mock return parcels. */
            returnParcels = generateReturnParcels(partnerProfile, oneDisplayConfigs.na);

            for (i = 0; i < returnParcels.length; i++) {
                requestObject = partnerInstance.__generateRequestObj([returnParcels[i]]);
                url = requestObject.url;
                expect(url.match(returnParcels[i].xSlotRef.placementId).length, "placementId is incorrect").to.equal(1);
            }
        })

        /* ---------- ADD MORE TEST CASES TO TEST CASES FOR EVERY NEW CHANGE/FEATURE ------------*/

    });
    /* -----------------------------------------------------------------------*/
});