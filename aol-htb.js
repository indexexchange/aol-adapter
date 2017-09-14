/**
 * @author:    Index Exchange <adapter-certification-eng@indexexchange.com>
 * @license:   UNLICENSED
 *
 * @copyright: Copyright (c) 2017 by Index Exchange. All rights reserved.
 *
 * The information contained within this document is confidential, copyrighted
 * and or a trade secret. No part of this document may be reproduced or
 * distributed in any form or by any means, in whole or in part, without the
 * prior written permission of Index Exchange.
 */

'use strict';

////////////////////////////////////////////////////////////////////////////////
// Dependencies ////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

var BidTransformer = require('bid-transformer.js');
var Browser = require('browser.js');
var Classify = require('classify.js');
var Constants = require('constants.js');
var OpenRtb = require('openrtb.js');
var Partner = require('partner.js');
var Size = require('size.js');
var SpaceCamp = require('space-camp.js');
var System = require('system.js');
var Network = require('network.js');
var Whoopsie = require('whoopsie.js');
var EventsService;
var RenderService;

//? if (DEBUG) {
var ConfigValidators = require('config-validators.js');
var PartnerSpecificValidator = require('aol-htb-validator.js');
var Scribe = require('scribe.js');
//? }

////////////////////////////////////////////////////////////////////////////////
// Main ////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

/**
 * AOL Header Tag Bidder module.
 *
 * @class
 */
function AolHtb(configs) {
    /* =====================================
     * Data
     * ---------------------------------- */

    /* Private
     * ---------------------------------- */

    /**
     * Reference to the partner base class.
     *
     * @private {object}
     */
    var __baseClass;

    /**
     * Profile for this partner.
     *
     * @private {object}
     */
    var __profile;

    /**
     * Instance of BidTransformer for transforming bids.
     *
     * @private {object}
     */
    var __bidTransformers;

    /**
     * Endpoints URLS
     * @type {{eu: string, na: string, asia: string}}
     */
    var endpointsUrls = {
        oneDisplay: {
            eu: '//adserver-eu.adtech.advertising.com',
            na: '//adserver-us.adtech.advertising.com',
            asia: '//adserver-as.adtech.advertising.com'
        },
        oneMobile: {
            get: '//hb.nexage.com'
        }
    };

    /* =====================================
     * Functions
     * ---------------------------------- */

    /* Utilities
     * ---------------------------------- */

    /**
     * Generates the request URL to the endpoint for the xSlots in the given
     * returnParcels.
     *
     * @param  {object[]} returnParcels
     * @return {string}
     */
    function __generateRequestObj(returnParcels) {
        var baseUrl = Browser.getProtocol() + endpointsUrls.oneDisplay[configs.region] + '/pubapi/3.0/' + configs.networkId;

        /* MRA partners receive only one parcel in the array. */
        var returnParcel = returnParcels[0];
        var xSlot = returnParcel.xSlotRef;

        /* generate a unique request identifier for storing request-specific information */
        var requestId = '_' + System.generateUniqueId();

        /* sizeid & pageid */
        var sizeId = xSlot.sizeId || '-1';
        var pageId = xSlot.pageId || '0';

        /* request params */
        var requestParams = {
            cmd: 'bid',
            cors: 'yes',
            v: '2',
            misc: System.now(),
            callback: 'window.' + SpaceCamp.NAMESPACE + '.' + __profile.namespace + '.adResponseCallbacks.' + requestId
        };

        if (xSlot.bidFloor) {
            requestParams.bidFloor = xSlot.bidFloor;
        }

        var url = Network.buildUrl(baseUrl, [xSlot.placementId, pageId, sizeId, 'ADTECH;']);

        /* build url paramters */
        for (var parameter in requestParams) {
            if (!requestParams.hasOwnProperty(parameter)) {
                continue;
            }
            url += parameter + '=' + requestParams[parameter] + ';';
        }

        return {
            url: url,
            callbackId: requestId
        };
    }

    /* Helpers
     * ---------------------------------- */

    /**
     * This function will render the ad given.
     * @param  {Object} doc The document of the iframe where the ad will go.
     * @param  {string} adm The ad code that came with the original demand.
     * @param  {string} pixel The tracking pixel url.
     */
    function __render(doc, adm, pixel) {
        if (pixel) {
            var iframe = Browser.createHiddenIFrame();
            System.documentWrite(iframe.contentDocument, pixel);
        }
        System.documentWrite(doc, adm);
    }

    /* Parse adResponse, put demand into outParcels.
     * AOL response contains a single result object.
     */
    function __parseResponse(sessionId, responseObj, returnParcels) {

        /* MRA partners receive only one parcel in the array. */
        var returnParcel = returnParcels[0];

        /* header stats information */
        var headerStatsInfo = {
            sessionId: sessionId,
            statsId: __profile.statsId,
            htSlotId: returnParcel.htSlot.getId(),
            xSlotNames: [returnParcel.xSlotName]
        };

        var ortbResponse = OpenRtb.BidResponse(responseObj);

        /* there is only one bid because mra */
        var bid = ortbResponse.getBids()[0];

        if (bid && !bid.hasOwnProperty('nbr')) {
            if (__profile.enabledAnalytics.requestTime) {
                EventsService.emit('hs_slot_bid', headerStatsInfo);
            }

            /* bid response */
            var bidPrice = bid.price;
            var bidCreative = bid.adm;
            var bidSize = [Number(bid.w), Number(bid.h)];
            var pixel = bid.ext.pixels;

            returnParcel.targetingType = 'slot';
            returnParcel.targeting = {};
            returnParcel.size = bidSize;

            var sizeKey = Size.arrayToString(bidSize);

            //? if(FEATURES.GPT_LINE_ITEMS) {
            var targetingCpm = __bidTransformers.targeting.apply(bidPrice);
            if (bid.hasOwnProperty('dealid')) { // dealid
                returnParcel.targeting[__baseClass._configs.targetingKeys.pm] = [sizeKey + '_' + bid.dealid];
            }
            returnParcel.targeting[__baseClass._configs.targetingKeys.om] = [sizeKey + '_' + targetingCpm];
            returnParcel.targeting[__baseClass._configs.targetingKeys.id] = [returnParcel.requestId];

            if (__baseClass._configs.lineItemType === Constants.LineItemTypes.ID_AND_SIZE) {
                RenderService.registerAdByIdAndSize(
                    sessionId,
                    __profile.partnerId,
                    __render, [bidCreative, pixel],
                    '',
                    __profile.features.demandExpiry.enabled ? (__profile.features.demandExpiry.value + System.now()) : 0,
                    returnParcel.requestId,
                    returnParcel.size
                );
            } else if (__baseClass._configs.lineItemType === Constants.LineItemTypes.ID_AND_PRICE) {
                RenderService.registerAdByIdAndPrice(
                    sessionId,
                    __profile.partnerId,
                    __render, [bidCreative, pixel],
                    '',
                    __profile.features.demandExpiry.enabled ? (__profile.features.demandExpiry.value + System.now()) : 0,
                    returnParcel.requestId,
                    targetingCpm
                );
            }
            //? }

            //? if(FEATURES.RETURN_CREATIVE) {
            returnParcel.adm = bidCreative;
            //? }

            //? if(FEATURES.RETURN_PRICE) {
            returnParcel.price = Number(__bidTransformers.price.apply(bidPrice));
            //? }

            //? if(FEATURES.INTERNAL_RENDER) {
            var pubKitAdId = RenderService.registerAd(
                sessionId,
                __profile.partnerId,
                __render, [bidCreative, pixel],
                '',
                __profile.features.demandExpiry.enabled ? (__profile.features.demandExpiry.value + System.now()) : 0
            );
            returnParcel.targeting.pubKitAdId = pubKitAdId;
            //? }

        } else {
            //? if (DEBUG) {
            Scribe.info(__profile.partnerId + ' no bid response for { id: ' + returnParcel.xSlotRef.placementId + ' }.');
            //? }

            if (__profile.enabledAnalytics.requestTime) {
                EventsService.emit('hs_slot_pass', headerStatsInfo);
            }

            returnParcel.pass = true;
        }

    }

    /* =====================================
     * Constructors
     * ---------------------------------- */

    (function __constructor() {
        EventsService = SpaceCamp.services.EventsService;
        RenderService = SpaceCamp.services.RenderService;

        __profile = {
            partnerId: 'AolHtb',
            namespace: 'AolHtb',
            statsId: 'AOL',
            version: '2.0.0',
            targetingType: 'slot',
            enabledAnalytics: {
                requestTime: true
            },
            features: {
                demandExpiry: {
                    enabled: false,
                    value: 0
                },
                rateLimiting: {
                    enabled: false,
                    value: 0
                }
            },
            targetingKeys: {
                om: 'ix_aol_om',
                pm: 'ix_aol_pm',
                id: 'ix_aol_id'
            },
            lineItemType: Constants.LineItemTypes.ID_AND_SIZE,
            callbackType: Partner.CallbackTypes.CALLBACK_NAME,
            architecture: Partner.Architectures.MRA,
            requestType: Partner.RequestTypes.ANY
        };

        //? if (DEBUG) {
        var results = ConfigValidators.partnerBaseConfig(configs) || PartnerSpecificValidator(configs);

        if (results) {
            throw Whoopsie('INVALID_CONFIG', results);
        }
        //? }

        // The default bid transformation for this partner. Adjust to match
        // units the partner sends bids in and to match line item setup.
        var bidTransformerConfigs = {
            //? if(FEATURES.GPT_LINE_ITEMS) {
            targeting: {
                inputCentsMultiplier: 100,
                outputCentsDivisor: 1,
                outputPrecision: 0,
                roundingType: 'FLOOR', // jshint ignore:line
                floor: 0,
                buckets: [{
                    max: 2000,
                    step: 5
                }, {
                    max: 5000,
                    step: 100
                }]
            },
            //? }
            //? if(FEATURES.RETURN_PRICE) {
            price: {
                inputCentsMultiplier: 100,
                outputCentsDivisor: 1,
                outputPrecision: 0,
                roundingType: 'NONE',
            },
            //? }
        };

        if (configs.bidTransformer) {
            //? if(FEATURES.GPT_LINE_ITEMS) {
            bidTransformerConfigs.targeting = configs.bidTransformer;
            //? }
            //? if(FEATURES.RETURN_PRICE) {
            bidTransformerConfigs.price.inputCentsMultiplier = configs.bidTransformer.inputCentsMultiplier;
            //? }
        }

        __bidTransformers = {};

        //? if(FEATURES.GPT_LINE_ITEMS) {
        __bidTransformers.targeting = BidTransformer(bidTransformerConfigs.targeting);
        //? }
        //? if(FEATURES.RETURN_PRICE) {
        __bidTransformers.price = BidTransformer(bidTransformerConfigs.price);
        //? }

        __baseClass = Partner(__profile, configs, null, {
            parseResponse: __parseResponse,
            generateRequestObj: __generateRequestObj
        });
    })();

    /* =====================================
     * Public Interface
     * ---------------------------------- */

    var derivedClass = {
        /* Class Information
         * ---------------------------------- */

        //? if (DEBUG) {
        __type__: 'AolHtb',
        //? }

        //? if (TEST) {
        __baseClass: __baseClass,
        //? }

        /* Data
         * ---------------------------------- */

        //? if (TEST) {
        __profile: __profile,
        //? }

        /* Functions
         * ---------------------------------- */

        //? if (TEST) {
        __generateRequestObj: __generateRequestObj,
        __parseResponse: __parseResponse
        //? }
    };

    return Classify.derive(__baseClass, derivedClass);
}

////////////////////////////////////////////////////////////////////////////////
// Exports /////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

module.exports = AolHtb;
