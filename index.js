"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledFunction1 = exports.scheduledFunction = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const image_size_1 = __importDefault(require("image-size"));
require("moment");
const cloudinary_1 = require("cloudinary");
const axios_1 = __importDefault(require("axios"));
//import * as corsLib from 'cors';
const express_1 = __importDefault(require("express"));
const bodyParser = __importStar(require("body-parser"));
const mailersend_1 = require("mailersend");
//import { now } from "moment";
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Initialize Firebase admin
// Cloudinary configuration
// Initialize MailerSend
const mailersend = new mailersend_1.MailerSend({
    apiKey: 'mlsn.3dad6a8c701c8f8f4fa4a290f899d8c244b6bb8a03fe6befd0b43ce6ce18e948',
});
//import { Timestamp } from "firebase-admin/firestore";
//import { user } from "firebase-functions/v1/auth";
/**
 * Converts parsed query string parameters to a typed object.
 * @param {ParsedQs} parsedQs The parsed query string parameters.
 * @return {Record<string, string | string[] | undefined>}
 */
function convertParsedQs(parsedQs) {
    const result = {};
    for (const key in parsedQs) {
        if (Object.prototype.hasOwnProperty.call(parsedQs, key)) {
            const value = parsedQs[key];
            result[key] = Array.isArray(value) ? value.map(String) :
                typeof value === "string" ? value : undefined;
        }
    }
    return result;
}
admin.initializeApp();
const db = admin.firestore();
const app = (0, express_1.default)();
cloudinary_1.v2.config({
    cloud_name: '<cloud_name>',
    api_key: '<api_key>',
    api_secret: '<api_secret>',
});
// latency
exports.getStreamData = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (req, res) => {
    // Get playbackId from request query or body
    const MUX_BASE_URL = 'https://api.mux.com/data/v1';
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const playbackId = req.body.playbackId;
    const matchId = req.body.matchId;
    let MUX_ACCESS_TOKEN = "";
    let MUX_SECRET_KEY = '';
    // Iterate over each sport
    const apiDoc = await admin.firestore()
        .collection("APIS").doc('api').get();
    const data = apiDoc.data();
    if (data != undefined) {
        MUX_ACCESS_TOKEN = data.muxTokenId;
        MUX_SECRET_KEY = data.muxTokenSecret;
    }
    if (!playbackId) {
        res.status(400).send('Error: playbackId is required');
        return;
    }
    try {
        // Request playback metrics for the specific playback ID
        const response = await axios_1.default.get(`${MUX_BASE_URL}/metrics/playback`, {
            auth: {
                username: MUX_ACCESS_TOKEN,
                password: MUX_SECRET_KEY,
            },
            params: {
                'filter[playback_id]': playbackId,
            },
        });
        const playbackMetrics = response.data.data;
        // Prepare data to save to Firestore
        const metricsToSave = {
            timestamp: new Date(),
            playbackId: playbackId,
            playbackMetrics: playbackMetrics,
        };
        // Save latency data to Firestore under a collection `playbackLatencyMetrics`
        await admin.firestore().collection('Matches')
            .doc(matchId).update({ latencyData: metricsToSave });
        res.json({ latencyData: metricsToSave });
        res.status(200).send(`Playback latency data stored successfully for playbackId: ${playbackId}`);
    }
    catch (error) {
        console.error('Error fetching playback latency data:', error);
        res.status(500).send('Error fetching playback latency data');
    }
});
//get users 
exports.getUsers = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const userIds = req.body.userIds;
    try {
        const users = await userIds.map(async (userId) => {
            const userData = await fetchUserData(userId);
            return userData;
        });
        res.json({ users: users });
        res.status(200).send(`users retrived successfully`);
    }
    catch (error) {
        console.error('Error fetching playback latency data:', error);
        res.status(500).send('Error fetching playback latency data');
    }
});
exports.addADS = functions.runWith({
    timeoutSeconds: 540, // Adjust the timeout value as needed
}).https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    try {
        const data = req.body;
        // Validate required fields
        if (!data.startDate || !data.endDate || !data.url || !Array.isArray(data.url)) {
            res.status(400).send("Invalid data. Please provide 'startDate', 'endDate', and 'url' as an array.");
            return;
        }
        // Convert startDate and endDate strings to Date objects
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            res.status(400).send("Invalid date format for 'startDate' or 'endDate'.");
            return;
        }
        // Generate a unique adId
        const adId = generateRandomUid(28);
        // Add the ad to Firestore
        await db.collection("ADS").doc(adId).set(Object.assign({ adId: adId, timestamp: admin.firestore.Timestamp.now(), startDate: admin.firestore.Timestamp.fromDate(startDate), endDate: admin.firestore.Timestamp.fromDate(endDate) }, data));
        const userData = await fetchUserData(data.authorId);
        const token = userData.token;
        if (token) {
            const message = {
                notification: {
                    title: 'New AD',
                    body: `Uploading AD complete`,
                },
                data: {
                    click_action: "FLUTTER_NOTIFICATION_CLICK",
                    tab: "/ADS",
                    d: data.adId
                },
                android: {
                    notification: {
                        sound: "default",
                        image: "",
                    },
                },
                token,
            };
            await sendANotification(message);
        }
        ;
        //sendEmail2(userData.email,userData.username,userData.collectionName,purchaseDetails);
        res.status(200).send("Success adding AD");
    }
    catch (error) {
        console.error("Error adding AD:", error);
        res.status(500).send("Error adding AD");
    }
});
const sendEmail2 = async (usermail, username, collection, purchaseDetails, amount, currency) => {
    const url = "https://api.mailersend.com/v1/email";
    const agoraapis = await admin.firestore().collection("APIS").doc("api").get();
    const data = agoraapis.data();
    let token = ""; // Replace with your actual MailerSend API token
    if (data != undefined) {
        token = data.emailApi;
    }
    // Map account type to role-specific functionalities
    const roleDescriptions = {
        Fan: `As a <strong>Fan</strong>, you are the heartbeat of the arena! You can:
      <ul style='text-align: left;'>
        <li>Watch live matches from your favorite local teams\.<\/li>
        <li>Like, comment, and share your thoughts on exciting moments\.<\/li>
        <li>Post videos and images to celebrate your favorite teams and players\.<\/li>
        <li>No more rumors—be there by watching events unfold live\.<\/li>
      <\/ul>`,
        Club: `As a <strong>Club</strong>, you have the power to:
      <ul style='text-align: left;'>
        <li>Create and manage a team of players.</li>
        <li>Organize and broadcast matches live for your fans.</li>
        <li>Engage with your audience and grow your club's presence.</li>
      </ul>`,
        Professional: `As a <strong>Professional</strong>, you can:
      <ul style='text-align: left;'>
        <li>Create and manage leagues, inviting teams to participate.</li>
        <li>Organize matches for league members and broadcast them live.</li>
        <li>Set up contests and create unforgettable moments for players and fans alike.</li>
        <li>Be part of a team as a player of a club.</li>
      </ul>`
    };
    const roleDescription = roleDescriptions[collection];
    const payload = {
        from: {
            email: "info@fansarenakenya.site", // Replace with your sender email
        },
        to: [
            {
                email: usermail, // Replace with the recipient email
            },
        ],
        subject: `Hello, ${username}! Thank You for Your Purchase!`,
        text: `Hi ${username}, thank you for your purchase of ${purchaseDetails}`,
        html: `
      <div style="font-family: Arial, sans-serif; text-align: center;">
        <img src="https://firebasestorage.googleapis.com/v0/b/fans-arena.appspot.com/o/Posts%2Fimages%2F1721637929628.jpg?alt=media&token=2bb7c202-6c8f-495e-af3f-585e32b2b261" alt="Fans Arena Logo" style="width: 150px; margin-bottom: 20px;" />
        <h1 style="font-size: 24px; color: #333;">
          Thank You for Your Purchase,
          <span style="color: yellow;">F</span>ans
          <span style="color: orange;">A</span>rena Member!
        </h1>
        <p style="font-size: 16px; color: #555;">
          Hi ${username}, we appreciate your support and are thrilled to have you with us.
        </p>
        <p style="font-size: 16px; color: #555;">
         Item purchased: ${purchaseDetails}
        </p>
          <p style="font-size: 16px; color: #555;">
         Amount: ${currency} ${amount}
        </p>
        <p style="font-size: 16px; color: #555;">
          ${roleDescription}
        </p>
        <p style="font-size: 14px; color: #777; margin-top: 20px;">
          Regards,<br/>
          Fans Arena Team
        </p>
      </div>
    `,
    };
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const error = await response.json();
            console.error("Error sending email:", error);
            throw new Error(`Failed to send email: ${response.statusText}`);
        }
        const result = await response.json();
        console.log("Email sent successfully:", result);
    }
    catch (error) {
        console.error("Error occurred:", error);
    }
};
// Ads fetching function
exports.getAddsData = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }
        const data = req.body;
        // Validate input
        if (!data.genre || !data.lat || !data.long) {
            res.status(400).send('Missing required fields: genre, lat, or long.');
            return;
        }
        const ads = [];
        const snapshots = await admin
            .firestore()
            .collection("ADS")
            .where("genre", "==", data.genre)
            .where("slot", "==", data.slot)
            .get();
        for (const doc of snapshots.docs) {
            const d = doc.data();
            if (d && d.lat != undefined && d.long != undefined && d["radius(km)"] != undefined) {
                const isWithinDistance = haversineDistance(data.lat, data.long, d.lat, d.long, d["radius(km)"]);
                if (isWithinDistance) {
                    if (d.authorId != "Fans Arena") {
                        const userData = await fetchUserData(d.authorId);
                        ads.push(Object.assign(Object.assign({}, d), { author: userData }));
                    }
                    else {
                        ads.push(Object.assign({}, d));
                    }
                }
            }
        }
        res.status(200).json({ ads });
    }
    catch (error) {
        console.error('Error fetching ads data:', error);
        res.status(500).send('Error fetching ads data');
    }
});
// Function to calculate the distance between two coordinates using the Haversine formula
function haversineDistance(lat1, lon1, lat2, lon2, maxDistance) {
    const R = 6371; // Radius of the Earth in kilometers
    // Convert degrees to radians
    const toRadians = (deg) => (deg * Math.PI) / 180;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
            Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    return distance <= maxDistance;
}
//my ads
exports.getMyAds = functions.runWith({
    timeoutSeconds: 540, // Adjust the timeout value as needed
}).https.onRequest(async (req, res) => {
    try {
        const { userId } = req.query; // Get userId from query params
        if (!userId) {
            res.status(400).send("User ID is required.");
            return;
        }
        // Query for ads authored by the user
        const adsSnapshot = await admin.firestore()
            .collection('ADS')
            .where('authorId', '==', userId) // Filter ads by authorId (matching the userId)
            .get();
        // Initialize an array to store the analytics data for each ad
        const adsAnalytics = [];
        if (adsSnapshot.empty) {
            res.status(200).json({ adsAnalytics: adsAnalytics });
            return;
        }
        // Process each ad that the user authored
        for (const adDoc of adsSnapshot.docs) {
            const data = adDoc.data();
            try {
                // Attempt to get the views subcollection
                const viewsSnapshot = await adDoc.ref.collection('views').get();
                // Initialize arrays for view counts by 2-hour intervals and day of the week
                let viewsByTimeOfDay = new Array(12).fill(0); // 12 intervals for a 24-hour day, each covering 2 hours
                let viewsByDayOfWeek = new Array(7).fill(0); // Views by day of the week (0: Sunday to 6: Saturday)
                if (!viewsSnapshot.empty) {
                    // Process views for this particular ad
                    viewsSnapshot.docs.forEach((viewDoc) => {
                        var _a;
                        const view = viewDoc.data();
                        const timestamp = (_a = view.timestamp) === null || _a === void 0 ? void 0 : _a.toDate(); // Ensure timestamp is a Firestore Timestamp
                        if (!timestamp)
                            return;
                        const hour = timestamp.getHours(); // Get the hour of the day (0-23)
                        const dayOfWeek = timestamp.getDay(); // Get the day of the week (0-6, 0=Sunday)
                        // Map hour to 2-hour interval index
                        const intervalIndex = Math.floor(hour / 2);
                        // Count views by 2-hour intervals
                        viewsByTimeOfDay[intervalIndex]++;
                        // Count views by day of the week
                        viewsByDayOfWeek[dayOfWeek]++;
                    });
                }
                // Find the interval with the most views
                const mostViewsIntervalIndex = viewsByTimeOfDay.indexOf(Math.max(...viewsByTimeOfDay));
                // Find the day with the most views
                const mostViewsDay = viewsByDayOfWeek.indexOf(Math.max(...viewsByDayOfWeek));
                // Prepare the analytics data for this ad
                const adAnalytics = Object.assign(Object.assign({}, data), { mostViewsHour: `${mostViewsIntervalIndex * 2}:00 to ${(mostViewsIntervalIndex * 2) + 2}:00`, mostViewsDay: getDayName(mostViewsDay), // Convert day index to name (Sunday, Monday, ...)
                    viewsByTimeOfDay,
                    viewsByDayOfWeek });
                // Add this ad's analytics data to the list
                adsAnalytics.push(adAnalytics);
            }
            catch (error) {
                // If the subcollection does not exist, return 0 views
                const adAnalytics = Object.assign(Object.assign({}, data), { mostViewsHour: "No Views", mostViewsDay: "No Views", viewsByTimeOfDay: new Array(12).fill(0), viewsByDayOfWeek: new Array(7).fill(0) });
                adsAnalytics.push(adAnalytics);
            }
        }
        // Return the final list of analytics data for all ads
        res.status(200).json({ adsAnalytics }); // Send response here
    }
    catch (error) {
        console.error("Error fetching ad views:", error);
        res.status(500).send("An error occurred while fetching the ad views.");
    }
});
// Helper function to get day name from index
function getDayName(dayIndex) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[dayIndex] || "Unknown";
}
//video data
exports.getVideoData = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const currentUserUid = queryParams["authorId"];
        if (!currentUserUid) {
            response.status(400).json({ error: "User ID is required" });
            return;
        }
        const userData = await fetchUserData(currentUserUid);
        const today = new Date();
        let userPlan = userData.plan;
        const planETime = userData.planETime.toDate();
        const signupDate = userData.timestamp.toDate();
        const oneMonthLater = new Date(signupDate.setMonth(signupDate.getMonth() + 1));
        if (today < oneMonthLater) {
            const videoData = {
                frameRate: 30,
                bitrate: 4000,
                count: 12,
            };
            response.json({ message: "Free one month plan", plan: "freeAll", videoData: videoData });
        }
        else {
            if (userPlan == "" || planETime < today || userPlan == undefined) {
                const snapshot = await admin.firestore().collection("Plans").doc("free").get();
                if (snapshot.exists) {
                    const data = snapshot.data();
                    if (data != undefined) {
                        const videoData = {
                            frameRate: data.frameRate,
                            bitrate: data.bitrate,
                            count: data.count,
                        };
                        response.json({ message: "User plan ", plan: 'free', videoData: videoData });
                    }
                }
            }
            else if (planETime > today) {
                const snapshot = await admin.firestore().collection("Plans").doc(userPlan).get();
                if (snapshot.exists) {
                    const data = snapshot.data();
                    if (data != undefined) {
                        const videoData = {
                            frameRate: data.frameRate,
                            bitrate: data.bitrate,
                            count: data.count,
                        };
                        response.json({ message: "User plan ", plan: userPlan, videoData: videoData });
                    }
                }
            }
        }
    }
    catch (error) {
        console.error("Error getting video data:", error);
        response.status(500).json({ error: "Failed to get video data: " + error });
    }
});
function isWithin24Hours(firestoreTimestamp) {
    // Convert Firestore Timestamp to JavaScript Date and get milliseconds
    const timestampMillis = firestoreTimestamp.toDate().getTime();
    const nowMillis = Date.now();
    const differenceInMillis = nowMillis - timestampMillis;
    const differenceInHours = differenceInMillis / (1000 * 60 * 60);
    return differenceInHours < 24;
}
exports.getPostsForFollowedUsers = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const currentUserUid = queryParams["uid"];
        const collection = queryParams["collection"];
        if (!currentUserUid) {
            response.status(400).json({ error: "User ID is required" });
            return;
        }
        // Initialize arrays for UIDs
        const followingUids = [currentUserUid];
        // Helper function to collect UIDs from Firestore snapshots
        const collectUids = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const followingData = doc.data()[key];
                followingData.forEach((item) => {
                    if (item.userId)
                        followingUids.push(item.userId);
                });
            });
        };
        // Helper function to collect UIDs from clubsteam snapshots
        const collectUidsFromClubsteam = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const clubsTeamTable = doc.data()[key] || [];
                const clubsteam = doc.data()['clubsteam'] || [];
                if (clubsTeamTable[1]) {
                    const fieldName = clubsTeamTable[1].fn;
                    clubsteam.forEach((clubItem) => {
                        if (clubItem[fieldName])
                            followingUids.push(clubItem[fieldName]);
                    });
                }
            });
        };
        // Collect UIDs from different collections
        const followingSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("following").get();
        collectUids(followingSnapshot, 'following');
        const clubSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("clubs").get();
        collectUids(clubSnapshot, 'clubs');
        const profesSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("professionals").get();
        collectUids(profesSnapshot, 'professionals');
        const fromclubSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("fans").get();
        collectUids(fromclubSnapshot, 'fans');
        const fromprofeSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("fans").get();
        collectUids(fromprofeSnapshot, 'fans');
        const fromclubteamSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("clubsteam").get();
        collectUidsFromClubsteam(fromclubteamSnapshot, 'clubsTeamTable');
        const fromprofetSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("trustedaccounts").get();
        collectUids(fromprofetSnapshot, 'accounts');
        const fromprofeclubSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("club").get();
        fromprofeclubSnapshot.forEach((doc) => {
            if (doc.id)
                followingUids.push(doc.id);
        });
        // Split the followingUids array into chunks of 30
        const chunkArray = (array, size) => {
            const result = [];
            for (let i = 0; i < array.length; i += size) {
                result.push(array.slice(i, i + size));
            }
            return result;
        };
        // Collect the unique UIDs (but do not remove currentUserUid for posts)
        const uniqueUidsForPosts = Array.from(new Set(followingUids));
        // Remove currentUserUid from the followingUids only for stories
        const uniqueUidsForStories = Array.from(new Set(followingUids.filter(uid => uid !== currentUserUid)));
        // Fetch posts and stories in chunks
        const postsPromises = chunkArray(uniqueUidsForPosts, 30).map(async (uids) => {
            const postsQuery = await admin.firestore().collection("posts")
                .where("authorId", "in", uids)
                .orderBy("createdAt", "desc")
                .limit(15)
                .get();
            return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
        });
        const postsArray = await Promise.all(postsPromises);
        const posts = [].concat(...postsArray);
        // Enrich posts with user data
        const enrichedPosts = await Promise.all(posts.map(async (post) => {
            const userData = await fetchUserData(post.authorId);
            const captionUrl = await getImageAspectRatios(post.captionUrl);
            const today = await isWithin24Hours(post.createdAt);
            return Object.assign(Object.assign({}, post), { author: userData, captionUrl: captionUrl, today: today });
        }));
        // Fetch stories (exclude currentUserUid)
        const storiesPromises = chunkArray(uniqueUidsForStories, 30).map(async (uids) => {
            const storiesQuery = await admin.firestore().collection("Story")
                .where("authorId", "in", uids)
                .orderBy("createdAt", "desc")
                .limit(8)
                .get();
            return storiesQuery.docs.map((doc) => (Object.assign({}, doc.data())));
        });
        const storiesArray = await Promise.all(storiesPromises);
        const stories = [].concat(...storiesArray);
        // Enrich stories with user data
        const enrichedStories = await Promise.all(stories.map(async (story) => {
            const userData = await fetchUserData(story.authorId);
            const today = await isWithin24Hours(story.createdAt);
            return Object.assign(Object.assign({}, story), { author: userData, today: today });
        }));
        let enrichedVideos = []; // Initialize variables outside the condition
        let allUsers = [];
        if (collection == "Fan") {
            // Fetch video data (You can adjust this as per the structure of your video collection)
            const videosQuery = await admin.firestore().collection("FansTv").orderBy("createdAt", "desc")
                .limit(4)
                .get();
            const videos = videosQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            // Enrich video data with user data
            enrichedVideos = await Promise.all(videos.map(async (post) => {
                const userData = await fetchUserData(post.authorId);
                return Object.assign(Object.assign({}, post), { author: userData });
            }));
            // Fetch users near the current user's location
            const userDoc = await admin.firestore().collection("Fans").doc(currentUserUid).get();
            if (userDoc.exists) {
                const data = userDoc.data();
                if (data) {
                    const latitude = data.clatitude;
                    const longitude = data.clongitude;
                    const postsQuery = await admin.firestore().collection("Clubs")
                        .where('clatitude', ">=", latitude - 0.5)
                        .where('clatitude', "<=", latitude + 0.5)
                        .where('clongitude', ">=", longitude - 0.5)
                        .where('clongitude', "<=", longitude + 0.5)
                        .orderBy("createdAt", "desc")
                        .limit(2)
                        .get();
                    const postsQuery1 = await admin.firestore().collection("Fans")
                        .where('clatitude', ">=", latitude - 0.5)
                        .where('clatitude', "<=", latitude + 0.5)
                        .where('clongitude', ">=", longitude - 0.5)
                        .where('clongitude', "<=", longitude + 0.5)
                        .orderBy("createdAt", "desc")
                        .limit(2)
                        .get();
                    const postsQuery2 = await admin.firestore().collection("Professionals")
                        .where('clatitude', ">=", latitude - 0.5)
                        .where('clatitude', "<=", latitude + 0.5)
                        .where('clongitude', ">=", longitude - 0.5)
                        .where('clongitude', "<=", longitude + 0.5)
                        .orderBy("createdAt", "desc")
                        .limit(2)
                        .get();
                    let users1 = postsQuery.docs.map((doc) => ({
                        userId: doc.id,
                        createdAt: doc.data().createdAt,
                        location: doc.data().Location,
                        name: doc.data().Clubname,
                        genre: doc.data().genre,
                        url: doc.data().profileimage,
                        collection: "Club",
                    }));
                    let users2 = postsQuery1.docs.map((doc) => ({
                        userId: doc.id,
                        createdAt: doc.data().createdAt,
                        location: doc.data().location,
                        name: doc.data().username,
                        genre: doc.data().genre,
                        url: doc.data().profileimage,
                        collection: "Fan",
                    }));
                    let users3 = postsQuery2.docs.map((doc) => ({
                        userId: doc.id,
                        createdAt: doc.data().createdAt,
                        location: doc.data().Location,
                        name: doc.data().Stagename,
                        genre: doc.data().genre,
                        url: doc.data().profileimage,
                        collection: "Professional",
                    }));
                    // Filter out users who are already being followed
                    users1 = users1.filter(user => !followingUids.includes(user.userId));
                    users2 = users2.filter(user => !followingUids.includes(user.userId));
                    users3 = users3.filter(user => !followingUids.includes(user.userId));
                    allUsers = [...users1, ...users2, ...users3];
                }
            }
        }
        response.status(200).json({ news: {
                posts: enrichedPosts,
                videos: enrichedVideos,
                stories: enrichedStories,
                users: allUsers,
            } });
    }
    catch (error) {
        response.status(500).json({ error: "Failed to retrieve data" });
    }
});
// get post 
exports.getPostById = functions.runWith({
    timeoutSeconds: 540, // Adjust the timeout value as needed
}).https.onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const postId = queryParams["postId"];
        if (!postId) {
            response.status(400).json({ error: "Post ID is required" });
            return;
        }
        // Fetch the single post by postId
        const postDoc = await admin.firestore().collection("posts").doc(postId).get();
        if (!postDoc.exists) {
            response.status(404).json({ error: "Post not found" });
            return;
        }
        // Fetch the user data of the author of the post
        const postData = postDoc.data();
        const authorId = postData === null || postData === void 0 ? void 0 : postData.authorId;
        const userData = await fetchUserData(authorId);
        const captionUrl = await getImageAspectRatios(postData === null || postData === void 0 ? void 0 : postData.captionUrl);
        // Return the single post with enriched author and caption URL data
        const enrichedPost = Object.assign(Object.assign({}, postData), { author: userData, captionUrl: captionUrl });
        response.json({ posts: enrichedPost });
    }
    catch (error) {
        console.error("Error getting post:", error);
        response.status(500).json({ error: "Failed to get post: " + error });
    }
});
exports.getFansTvById = functions.runWith({
    timeoutSeconds: 540, // Adjust the timeout value as needed
}).https.onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const postId = queryParams["postId"];
        if (!postId) {
            response.status(400).json({ error: "Post ID is required" });
            return;
        }
        // Fetch the single post by postId
        const postDoc = await admin.firestore().collection("FansTv").doc(postId).get();
        if (!postDoc.exists) {
            response.status(404).json({ error: "Post not found" });
            return;
        }
        // Fetch the user data of the author of the post
        const postData = postDoc.data();
        const authorId = postData === null || postData === void 0 ? void 0 : postData.authorId;
        const userData = await fetchUserData(authorId);
        // Return the single post with enriched author and caption URL data
        const enrichedPost = Object.assign(Object.assign({}, postData), { author: userData });
        response.json({ posts: enrichedPost });
    }
    catch (error) {
        console.error("Error getting post:", error);
        response.status(500).json({ error: "Failed to get post: " + error });
    }
});
async function getImageAspectRatios(captionUrl) {
    const fetchImageData = async (url) => {
        const response = await axios_1.default.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    };
    const promises = captionUrl.map(async (data) => {
        try {
            const imageData = await fetchImageData(data.url);
            const dimensions = (0, image_size_1.default)(imageData);
            if (dimensions.width && dimensions.height) {
                return {
                    caption: data.caption,
                    url: data.url,
                    height: dimensions.height,
                    width: dimensions.width,
                };
            }
            else {
                throw new Error(`Could not retrieve dimensions for image: ${data.url}`);
            }
        }
        catch (error) {
            console.error(`Error processing image at ${data.url}:`, error);
            return {
                caption: data.caption,
                url: data.url,
                height: 1,
                width: 1,
            };
        }
    });
    try {
        const aspectRatios = await Promise.all(promises);
        return aspectRatios;
    }
    catch (error) {
        throw new Error(`Error processing image aspect ratios: ${error}`);
    }
}
exports.getSavedPosts = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const currentUserUid = queryParams["uid"];
        const collection = queryParams["collection"];
        if (!currentUserUid) {
            response.status(400).json({ error: "uid is required" });
            return;
        }
        // Retrieve saved posts from the subcollection
        const savedPostsSnapshot = await admin.firestore()
            .collection(collection).doc(currentUserUid).collection("savedposts").get();
        const postIds = [];
        // Process each document in the savedPosts subcollection
        savedPostsSnapshot.forEach((doc) => {
            const savedPosts = doc.data().posts;
            savedPosts.forEach((item) => {
                if (item.postId) {
                    postIds.push(item.postId);
                }
            });
        });
        const chunkArray = (array, size) => {
            const result = [];
            for (let i = 0; i < array.length; i += size) {
                result.push(array.slice(i, i + size));
            }
            return result;
        };
        const postIdChunks = chunkArray(postIds, 30); // Firestore allows 30 items in 'in' query
        const postsPromises = postIdChunks.map(async (chunk) => {
            const postsQuery = await admin.firestore().collection("posts")
                .where("postId", "in", chunk)
                .get();
            return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
        });
        const postsArray = await Promise.all(postsPromises);
        const posts = [].concat(...postsArray);
        const enrichedPosts = await Promise.all(posts.map(async (post) => {
            const userData = await fetchUserData(post.authorId);
            const captionUrl = await getImageAspectRatios(post.captionUrl);
            return Object.assign(Object.assign({}, post), { author: userData, captionUrl: captionUrl });
        }));
        response.json({ posts: enrichedPosts });
    }
    catch (error) {
        console.error("Error getting saved posts:", error);
        response.status(500).json({ error: "Failed to get saved posts" + error });
    }
});
exports.getSavedFansTv = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const currentUserUid = queryParams["uid"];
        const collection = queryParams["collection"];
        if (!currentUserUid) {
            response.status(400).json({ error: "uid is required" });
            return;
        }
        const postIds = [];
        // Retrieve saved posts from the subcollection
        const savedPostsSnapshot = await admin.firestore()
            .collection(collection).doc(currentUserUid).collection("savedFansTv").get();
        savedPostsSnapshot.forEach((doc) => {
            const savedPosts = doc.data().FansTv;
            savedPosts.forEach((item) => {
                if (item.postId) {
                    postIds.push(item.postId);
                }
            });
        });
        const chunkArray = (array, size) => {
            const result = [];
            for (let i = 0; i < array.length; i += size) {
                result.push(array.slice(i, i + size));
            }
            return result;
        };
        const postIdChunks = chunkArray(postIds, 30); // Firestore allows 30 items in 'in' query
        const postsPromises = postIdChunks.map(async (chunk) => {
            const postsQuery = await admin.firestore().collection("FansTv")
                .where("postId", "in", chunk)
                .get();
            return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
        });
        const postsArray = await Promise.all(postsPromises);
        const posts = [].concat(...postsArray);
        const enrichedPosts = await Promise.all(posts.map(async (post) => {
            const userData = await fetchUserData(post.authorId);
            return Object.assign(Object.assign({}, post), { author: userData });
        }));
        response.json({ posts: enrichedPosts });
    }
    catch (error) {
        console.error("Error getting saved posts:", error);
        response.status(500).json({ error: "Failed to get saved posts" + error });
    }
});
// Fanstv
exports.getFansTv =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const currentUserUid = queryParams["uid"];
            if (!currentUserUid) {
                response.status(400).json({ error: "User ID is required" });
                return;
            }
            const followingUids = [currentUserUid];
            const collectUids = (snapshot, key) => {
                snapshot.forEach((doc) => {
                    const followingData = doc.data()[key];
                    followingData.forEach((item) => {
                        if (item.userId) {
                            followingUids.push(item.userId);
                        }
                    });
                });
            };
            const collectUids1 = (snapshot, key) => {
                snapshot.forEach((doc) => {
                    const clubsTeamTable = doc.data()[key] || [];
                    const clubsteam = doc.data()['clubsteam'] || [];
                    if (clubsTeamTable[1]) {
                        const fieldName = clubsTeamTable[1].fn;
                        clubsteam.forEach((clubItem) => {
                            if (clubItem[fieldName]) {
                                followingUids.push(clubItem[fieldName]);
                            }
                        });
                    }
                });
            };
            // Collecting following UIDs
            const followingSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("following").get();
            collectUids(followingSnapshot, 'following');
            const clubSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("clubs").get();
            collectUids(clubSnapshot, 'clubs');
            const profesSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("professionals").get();
            collectUids(profesSnapshot, 'professionals');
            const fromclubSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("fans").get();
            collectUids(fromclubSnapshot, 'fans');
            const fromprofeSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("fans").get();
            collectUids(fromprofeSnapshot, 'fans');
            const fromclubteamSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("clubsteam").get();
            collectUids1(fromclubteamSnapshot, 'clubsTeamTable');
            const fromprofetSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("trustedaccounts").get();
            collectUids(fromprofetSnapshot, 'accounts');
            const fromprofeclubSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("club").get();
            fromprofeclubSnapshot.forEach((doc) => {
                if (doc.id) {
                    followingUids.push(doc.id);
                }
            });
            const postsQuery = await admin.firestore().collection("FansTv")
                .orderBy("createdAt", "desc")
                .limit(8)
                .get();
            const posts1 = postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            const posts = await Promise.all(posts1.map(async (post) => {
                // Fetch user data for each post's authorId
                const userData = await fetchUserData(post.authorId);
                // Merge user data into the post object
                return Object.assign(Object.assign({}, post), { author: userData });
            }));
            response.json({ posts });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
async function fetchUserData(authorId) {
    let username = '';
    let imageurl = '';
    let collectionName = '';
    let location = '';
    let motto = '';
    let token = '';
    let doc;
    let createdAt;
    let country = "Kenya";
    let plan = "";
    let planETime = admin.firestore.Timestamp.now(); // Default value
    let email = "";
    if (authorId) {
        const clubSnapshot = await admin.firestore().collection('Clubs').doc(authorId).get();
        if (clubSnapshot.exists) {
            const clubData = clubSnapshot.data();
            username = clubData === null || clubData === void 0 ? void 0 : clubData.Clubname;
            imageurl = clubData === null || clubData === void 0 ? void 0 : clubData.profileimage;
            location = clubData === null || clubData === void 0 ? void 0 : clubData.Location;
            createdAt = clubData === null || clubData === void 0 ? void 0 : clubData.createdAt;
            motto = clubData === null || clubData === void 0 ? void 0 : clubData.Motto;
            collectionName = 'Club';
            token = clubData === null || clubData === void 0 ? void 0 : clubData.fcmToken;
            doc = clubSnapshot.ref;
            country = clubData === null || clubData === void 0 ? void 0 : clubData.country;
            email = clubData === null || clubData === void 0 ? void 0 : clubData.email;
            if ((clubData === null || clubData === void 0 ? void 0 : clubData.plan) !== undefined) {
                plan = clubData === null || clubData === void 0 ? void 0 : clubData.plan;
                planETime = (clubData === null || clubData === void 0 ? void 0 : clubData.planETime) || admin.firestore.Timestamp.now();
            }
        }
        else {
            const professionalSnapshot = await admin.firestore().collection('Professionals').doc(authorId).get();
            if (professionalSnapshot.exists) {
                const professionalData = professionalSnapshot.data();
                username = professionalData === null || professionalData === void 0 ? void 0 : professionalData.Stagename;
                imageurl = professionalData === null || professionalData === void 0 ? void 0 : professionalData.profileimage;
                location = professionalData === null || professionalData === void 0 ? void 0 : professionalData.Location;
                createdAt = professionalData === null || professionalData === void 0 ? void 0 : professionalData.createdAt;
                collectionName = 'Professional';
                token = professionalData === null || professionalData === void 0 ? void 0 : professionalData.fcmToken;
                doc = professionalSnapshot.ref;
                country = professionalData === null || professionalData === void 0 ? void 0 : professionalData.country;
                email = professionalData === null || professionalData === void 0 ? void 0 : professionalData.email;
                if ((professionalData === null || professionalData === void 0 ? void 0 : professionalData.plan) !== undefined) {
                    plan = professionalData === null || professionalData === void 0 ? void 0 : professionalData.plan;
                    planETime = (professionalData === null || professionalData === void 0 ? void 0 : professionalData.planETime) || admin.firestore.Timestamp.now();
                }
            }
            else {
                const fanSnapshot = await admin.firestore().collection('Fans').doc(authorId).get();
                if (fanSnapshot.exists) {
                    const fanData = fanSnapshot.data();
                    username = fanData === null || fanData === void 0 ? void 0 : fanData.username;
                    imageurl = fanData === null || fanData === void 0 ? void 0 : fanData.profileimage;
                    location = fanData === null || fanData === void 0 ? void 0 : fanData.location;
                    createdAt = fanData === null || fanData === void 0 ? void 0 : fanData.createdAt;
                    collectionName = 'Fan';
                    token = fanData === null || fanData === void 0 ? void 0 : fanData.fcmToken;
                    doc = fanSnapshot.ref;
                    country = fanData === null || fanData === void 0 ? void 0 : fanData.country;
                    email = fanData === null || fanData === void 0 ? void 0 : fanData.email;
                }
                else {
                    const leagueSnapshot = await admin.firestore().collection('Leagues').doc(authorId).get();
                    if (leagueSnapshot.exists) {
                        const leagueData = leagueSnapshot.data();
                        username = leagueData === null || leagueData === void 0 ? void 0 : leagueData.leaguename;
                        imageurl = leagueData === null || leagueData === void 0 ? void 0 : leagueData.profileimage;
                        location = leagueData === null || leagueData === void 0 ? void 0 : leagueData.location;
                        createdAt = leagueData === null || leagueData === void 0 ? void 0 : leagueData.createdAt;
                        collectionName = 'League';
                        doc = leagueSnapshot.ref;
                        country = leagueData === null || leagueData === void 0 ? void 0 : leagueData.country;
                    }
                    else {
                        username = '';
                        imageurl = '';
                        location = '';
                        collectionName = "";
                        motto = "";
                    }
                }
            }
        }
    }
    return {
        profileImage: imageurl,
        username: username,
        collectionName: collectionName,
        location: location,
        motto: motto,
        userId: authorId,
        docRef: doc,
        token: token,
        timestamp: createdAt,
        country: country,
        plan: plan,
        planETime: planETime,
        email: email,
    };
}
async function fetchLeagueyears(leagueId) {
    let leagues = [];
    if (leagueId) {
        const leagueSnapshot = await admin.firestore()
            .collection('Leagues').doc(leagueId)
            .collection('year').orderBy('timestamp', 'desc').get();
        leagueSnapshot.docs.map((doc) => {
            leagues.push(doc.id);
        });
    }
    return {
        leagues: leagues,
    };
}
// more posts
exports.getmorePostsForFollowedUsers = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https
    .onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const currentUserUid = queryParams["uid"];
        const lastdocId = queryParams["lastdocId"];
        if (!currentUserUid || !lastdocId) {
            response.status(400).json({ error: "uid and lastdocId is required" });
            return;
        }
        const followingUids = [currentUserUid];
        const collectUids = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const followingData = doc.data()[key];
                followingData.forEach((item) => {
                    if (item.userId) {
                        followingUids.push(item.userId);
                    }
                });
            });
        };
        const collectUids1 = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const clubsTeamTable = doc.data()[key] || [];
                const clubsteam = doc.data()['clubsteam'] || [];
                if (clubsTeamTable[1]) {
                    const fieldName = clubsTeamTable[1].fn;
                    clubsteam.forEach((clubItem) => {
                        if (clubItem[fieldName]) {
                            followingUids.push(clubItem[fieldName]);
                        }
                    });
                }
            });
        };
        // Collecting following UIDs
        const followingSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("following").get();
        collectUids(followingSnapshot, 'following');
        const clubSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("clubs").get();
        collectUids(clubSnapshot, 'clubs');
        const profesSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("professionals").get();
        collectUids(profesSnapshot, 'professionals');
        const fromclubSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("fans").get();
        collectUids(fromclubSnapshot, 'fans');
        const fromprofeSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("fans").get();
        collectUids(fromprofeSnapshot, 'fans');
        const fromclubteamSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("clubsteam").get();
        collectUids1(fromclubteamSnapshot, 'clubsTeamTable');
        const fromprofetSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("trustedaccounts").get();
        collectUids(fromprofetSnapshot, 'accounts');
        const fromprofeclubSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("club").get();
        fromprofeclubSnapshot.forEach((doc) => {
            if (doc.id) {
                followingUids.push(doc.id);
            }
        });
        // Split the followingUids array into chunks of 30
        const uniqueUids = Array.from(new Set(followingUids)).filter(Boolean);
        const chunkArray = (array, size) => {
            const result = [];
            for (let i = 0; i < array.length; i += size) {
                result.push(array.slice(i, i + size));
            }
            return result;
        };
        const doc = await admin.firestore().collection("posts").doc(lastdocId).get();
        const uidChunks = chunkArray(uniqueUids, 30);
        const postsPromises = uidChunks.map(async (uids) => {
            const postsQuery = await admin.firestore().collection("posts")
                .where("authorId", "in", uids)
                .orderBy("createdAt", "desc")
                .startAfter(doc)
                .limit(10)
                .get();
            return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
        });
        const postsArray = await Promise.all(postsPromises);
        const posts = [].concat(...postsArray);
        const enrichedPosts = await Promise.all(posts.map(async (post) => {
            const userData = await fetchUserData(post.authorId);
            const captionUrl = await getImageAspectRatios(post.captionUrl);
            return Object.assign(Object.assign({}, post), { author: userData, captionUrl: captionUrl });
        }));
        response.json({ posts: enrichedPosts });
    }
    catch (error) {
        console.error("Error getting posts:", error);
        response.status(500).json({ error: "Failed to get posts" + error });
    }
});
// more posts
exports.getmoreFansTv = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https
    .onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const currentUserUid = queryParams["uid"];
        const lastdocId = queryParams["lastdocId"];
        if (!currentUserUid || !lastdocId) {
            response.status(400).json({ error: "uid and lastdocId is required" });
            return;
        }
        const followingUids = [currentUserUid];
        const collectUids = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const followingData = doc.data()[key];
                followingData.forEach((item) => {
                    if (item.userId) {
                        followingUids.push(item.userId);
                    }
                });
            });
        };
        const collectUids1 = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const clubsTeamTable = doc.data()[key] || [];
                const clubsteam = doc.data()['clubsteam'] || [];
                if (clubsTeamTable[1]) {
                    const fieldName = clubsTeamTable[1].fn;
                    clubsteam.forEach((clubItem) => {
                        if (clubItem[fieldName]) {
                            followingUids.push(clubItem[fieldName]);
                        }
                    });
                }
            });
        };
        // Collecting following UIDs
        const followingSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("following").get();
        collectUids(followingSnapshot, 'following');
        const clubSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("clubs").get();
        collectUids(clubSnapshot, 'clubs');
        const profesSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("professionals").get();
        collectUids(profesSnapshot, 'professionals');
        const fromclubSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("fans").get();
        collectUids(fromclubSnapshot, 'fans');
        const fromprofeSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("fans").get();
        collectUids(fromprofeSnapshot, 'fans');
        const fromclubteamSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("clubsteam").get();
        collectUids1(fromclubteamSnapshot, 'clubsTeamTable');
        const fromprofetSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("trustedaccounts").get();
        collectUids(fromprofetSnapshot, 'accounts');
        const fromprofeclubSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("club").get();
        fromprofeclubSnapshot.forEach((doc) => {
            if (doc.id) {
                followingUids.push(doc.id);
            }
        });
        const lastDoc = await admin.firestore()
            .collection('FansTv').doc(lastdocId).get();
        let postsQuery = admin.firestore().collection("FansTv")
            .orderBy("createdAt", "desc");
        postsQuery = postsQuery.startAfter(lastDoc);
        postsQuery = postsQuery.limit(8);
        const postsQuerySnapshot = await postsQuery.get();
        const posts1 = postsQuerySnapshot.docs.map((doc) => (Object.assign({}, doc.data())));
        const posts = await Promise.all(posts1.map(async (post) => {
            // Fetch user data for each post's authorId
            const userData = await fetchUserData(post.authorId);
            // Merge user data into the post object
            return Object.assign(Object.assign({}, post), { author: userData });
        }));
        response.json({ posts });
    }
    catch (error) {
        console.error("Error getting posts:", error);
        response.status(500).json({ error: "Failed to get posts" + error });
    }
});
// stories
exports.getStoryForFollowedUsers =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const currentUserUid = queryParams["uid"];
            if (!currentUserUid) {
                response.status(400).json({ error: "User ID is required" });
                return;
            }
            const followingUids = [];
            const collectUids = (snapshot, key) => {
                snapshot.forEach((doc) => {
                    const followingData = doc.data()[key];
                    followingData.forEach((item) => {
                        if (item.userId) {
                            followingUids.push(item.userId);
                        }
                    });
                });
            };
            const collectUids1 = (snapshot, key) => {
                snapshot.forEach((doc) => {
                    const clubsTeamTable = doc.data()[key] || [];
                    const clubsteam = doc.data()['clubsteam'] || [];
                    if (clubsTeamTable[1]) {
                        const fieldName = clubsTeamTable[1].fn;
                        clubsteam.forEach((clubItem) => {
                            if (clubItem[fieldName]) {
                                followingUids.push(clubItem[fieldName]);
                            }
                        });
                    }
                });
            };
            // Collecting following UIDs
            const followingSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("following").get();
            collectUids(followingSnapshot, 'following');
            const clubSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("clubs").get();
            collectUids(clubSnapshot, 'clubs');
            const profesSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("professionals").get();
            collectUids(profesSnapshot, 'professionals');
            const fromclubSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("fans").get();
            collectUids(fromclubSnapshot, 'fans');
            const fromprofeSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("fans").get();
            collectUids(fromprofeSnapshot, 'fans');
            const fromclubteamSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("clubsteam").get();
            collectUids1(fromclubteamSnapshot, 'clubsTeamTable');
            const fromprofetSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("trustedaccounts").get();
            collectUids(fromprofetSnapshot, 'accounts');
            const fromprofeclubSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("club").get();
            fromprofeclubSnapshot.forEach((doc) => {
                if (doc.id) {
                    followingUids.push(doc.id);
                }
            });
            // Split the followingUids array into chunks of 30
            const uniqueUids = Array.from(new Set(followingUids)).filter(Boolean);
            const chunkArray = (array, size) => {
                const result = [];
                for (let i = 0; i < array.length; i += size) {
                    result.push(array.slice(i, i + size));
                }
                return result;
            };
            const uidChunks = chunkArray(uniqueUids, 30);
            const postsPromises = uidChunks.map(async (uids) => {
                const postsQuery = await admin.firestore().collection("Story")
                    .where("authorId", "in", uids)
                    .orderBy("createdAt", "desc")
                    .limit(10)
                    .get();
                return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            });
            const postsArray = await Promise.all(postsPromises);
            const posts = [].concat(...postsArray);
            const enrichedPosts = await Promise.all(posts.map(async (post) => {
                const userData = await fetchUserData(post.authorId);
                return Object.assign(Object.assign({}, post), { author: userData });
            }));
            response.json({ story: enrichedPosts });
        }
        catch (error) {
            console.error("Error getting story:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
// more storys
exports.getmoreStoryForFollowedUsers = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https
    .onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const currentUserUid = queryParams["uid"];
        const lastdocId = queryParams["lastdocId"];
        if (!currentUserUid || !lastdocId) {
            response.status(400).json({ error: "uid and lastdocId is required" });
            return;
        }
        const followingUids = [];
        const collectUids = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const followingData = doc.data()[key];
                followingData.forEach((item) => {
                    if (item.userId) {
                        followingUids.push(item.userId);
                    }
                });
            });
        };
        const collectUids1 = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const clubsTeamTable = doc.data()[key] || [];
                const clubsteam = doc.data()['clubsteam'] || [];
                if (clubsTeamTable[1]) {
                    const fieldName = clubsTeamTable[1].fn;
                    clubsteam.forEach((clubItem) => {
                        if (clubItem[fieldName]) {
                            followingUids.push(clubItem[fieldName]);
                        }
                    });
                }
            });
        };
        // Collecting following UIDs
        const followingSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("following").get();
        collectUids(followingSnapshot, 'following');
        const clubSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("clubs").get();
        collectUids(clubSnapshot, 'clubs');
        const profesSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("professionals").get();
        collectUids(profesSnapshot, 'professionals');
        const fromclubSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("fans").get();
        collectUids(fromclubSnapshot, 'fans');
        const fromprofeSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("fans").get();
        collectUids(fromprofeSnapshot, 'fans');
        const fromclubteamSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("clubsteam").get();
        collectUids1(fromclubteamSnapshot, 'clubsTeamTable');
        const fromprofetSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("trustedaccounts").get();
        collectUids(fromprofetSnapshot, 'accounts');
        const fromprofeclubSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("club").get();
        fromprofeclubSnapshot.forEach((doc) => {
            if (doc.id) {
                followingUids.push(doc.id);
            }
        });
        // Split the followingUids array into chunks of 30
        const uniqueUids = Array.from(new Set(followingUids)).filter(Boolean);
        const chunkArray = (array, size) => {
            const result = [];
            for (let i = 0; i < array.length; i += size) {
                result.push(array.slice(i, i + size));
            }
            return result;
        };
        const doc = await admin.firestore().collection("Story").doc(lastdocId).get();
        const uidChunks = chunkArray(uniqueUids, 30);
        const postsPromises = uidChunks.map(async (uids) => {
            const postsQuery = await admin.firestore().collection("Story")
                .where("authorId", "in", uids)
                .orderBy("createdAt", "desc")
                .startAfter(doc)
                .limit(10)
                .get();
            return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
        });
        const postsArray = await Promise.all(postsPromises);
        const posts = [].concat(...postsArray);
        const enrichedPosts = await Promise.all(posts.map(async (post) => {
            const userData = await fetchUserData(post.authorId);
            return Object.assign(Object.assign({}, post), { author: userData });
        }));
        response.json({ story: enrichedPosts });
    }
    catch (error) {
        console.error("Error getting story:", error);
        response.status(500).json({ error: "Failed to get posts" + error });
    }
});
// leagues
exports.getLeaguesForUser = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const currentUserUid = queryParams["uid"];
        if (!currentUserUid) {
            response.status(400).json({ error: "User ID is required" });
            return;
        }
        const followingUids = [currentUserUid];
        const leagueUids = new Set();
        // Fetch clubs from 'Fans' collection
        const fanClubSnapshot = await admin.firestore()
            .collection("Fans").doc(currentUserUid).collection("clubs").get();
        fanClubSnapshot.forEach((doc) => {
            const followingData = doc.data().clubs;
            followingData.forEach((club) => {
                followingUids.push(club.userId);
            });
        });
        const fanProfessionalSnapshot = await admin.firestore()
            .collection("Fans").doc(currentUserUid).collection("professionals").get();
        fanProfessionalSnapshot.forEach((doc) => {
            const followingData = doc.data().professionals;
            followingData.forEach((club) => {
                followingUids.push(club.userId);
            });
        });
        // Fetch clubs from 'Professionals' collection
        const professionalClubSnapshot = await admin.firestore()
            .collection("Professionals").doc(currentUserUid)
            .collection("club").get();
        professionalClubSnapshot.forEach((doc) => {
            followingUids.push(doc.id);
        });
        // Fetch all league IDs
        const allLeaguesSnapshot = await admin.firestore()
            .collection("Leagues").get();
        for (const leagueDoc of allLeaguesSnapshot.docs) {
            const leagueId = leagueDoc.id;
            const latestYearDocQuery = await admin.firestore()
                .collection("Leagues").doc(leagueId)
                .collection("year").orderBy("timestamp", "desc").limit(1).get();
            if (!latestYearDocQuery.empty) {
                const latestYearDocId = latestYearDocQuery.docs[0].id;
                const latestYearData = latestYearDocQuery.docs[0].data();
                // Ensure leagueTable[1] exists and extract fn field value
                if (latestYearData.leagueTable && latestYearData.leagueTable[1]) {
                    const fnField = latestYearData.leagueTable[1].fn;
                    const yearPostsQuery = await admin.firestore()
                        .collection("Leagues").doc(leagueId)
                        .collection("year").doc(latestYearDocId)
                        .collection("clubs").get();
                    yearPostsQuery.docs.forEach((doc) => {
                        const clubData = doc.data().clubs;
                        clubData.forEach((club) => {
                            if (followingUids.includes(club[fnField])) {
                                leagueUids.add(leagueId);
                            }
                        });
                    });
                }
            }
            const postsQuery = await admin.firestore()
                .collection("Leagues").doc(leagueId)
                .collection("subscribers").get();
            postsQuery.forEach((doc) => {
                const subscriberData = doc.data().subscribers;
                subscriberData.forEach((subscriber) => {
                    if (subscriber.userId === currentUserUid) {
                        leagueUids.add(leagueId);
                    }
                });
            });
        }
        const allLeagues = [];
        const uniqueLeagueIds = Array.from(leagueUids);
        for (const uid of uniqueLeagueIds) {
            const leagueDoc = await admin.firestore()
                .collection("Leagues").doc(uid).get();
            if (leagueDoc.exists) {
                const leagueData = leagueDoc.data();
                if (leagueData) {
                    const data = await fetchLeagueyears(leagueDoc.id);
                    const data1 = await fetchUserData(leagueData.authorId);
                    const league = {
                        createdAt: leagueData.createdAt,
                        authorId: leagueData.authorId,
                        leagueId: leagueDoc.id,
                        genre: leagueData.genre,
                        location: leagueData.location,
                        leaguename: leagueData.leaguename,
                        profileimage: leagueData.profileimage,
                        author: data1,
                        accountType: leagueData.accountType,
                        leagues: data.leagues,
                    };
                    allLeagues.push(league);
                }
            }
        }
        response.json({ leagues: allLeagues });
    }
    catch (error) {
        console.error("Error getting leagues:", error);
        response.status(500).json({ error: "Failed to get leagues" + error });
    }
});
//get league
exports.getLeague =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const leagueId = queryParams["leagueId"];
            if (!leagueId) {
                response.status(400).json({ error: "leagueId is required" });
                return;
            }
            // const allleagueUids: string[] = [];
            //const lleagueUids: string[] = [];
            const leagueDoc = await admin.firestore()
                .collection("Leagues").doc(leagueId).get();
            if (leagueDoc.exists) {
                const leagueData = leagueDoc.data();
                if (leagueData) {
                    const data1 = await fetchUserData(leagueData.authorId);
                    const data = await fetchLeagueyears(leagueDoc.id);
                    const league = {
                        createdAt: leagueData.createdAt,
                        authorId: leagueData.authorId,
                        leagueId: leagueDoc.id,
                        genre: leagueData.genre,
                        location: leagueData.location,
                        leaguename: leagueData.leaguename,
                        profileimage: leagueData.profileimage,
                        accountType: leagueData.accountType,
                        author: data1,
                        leagues: data.leagues,
                    };
                    // Respond with the league data
                    response.json({ league });
                }
            }
        }
        catch (error) {
            console.error("Error getting leagues:", error);
            response.status(500).json({ error: "Failed to get league" + error });
        }
    });
//getmyleague
exports.getmyLeague =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const authorId = queryParams["authorId"];
            if (!authorId) {
                response.status(400).json({ error: "authorId is required" });
                return;
            }
            // const allleagueUids: string[] = [];
            //const lleagueUids: string[] = [];
            const leagueDoc = await admin.firestore()
                .collection("Leagues").where('authorId', '==', authorId).limit(1).get();
            if (leagueDoc.docs[0].exists) {
                const doc = leagueDoc.docs[0];
                const leagueData = doc.data();
                if (leagueData) {
                    const data1 = await fetchUserData(leagueData.authorId);
                    const data = await fetchLeagueyears(doc.id);
                    const league = {
                        createdAt: leagueData.createdAt,
                        authorId: leagueData.authorId,
                        leagueId: doc.id,
                        genre: leagueData.genre,
                        location: leagueData.location,
                        leaguename: leagueData.leaguename,
                        profileimage: leagueData.profileimage,
                        accountType: leagueData.accountType,
                        author: data1,
                        leagues: data.leagues,
                    };
                    // Respond with the league data
                    response.json({ league });
                }
            }
        }
        catch (error) {
            console.error("Error getting leagues:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
//posts send notification
exports.sendPostNotifications = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).firestore
    .document('posts/{postId}')
    .onCreate(async (snap) => {
    try {
        const post = snap.data();
        const currentUserUid = post.authorId;
        // Send notification to author's followers
        const followingUids = new Set();
        let imageurl = '';
        const collectUids = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const followingData = doc.data()[key];
                followingData.forEach((item) => {
                    if (item.userId) {
                        followingUids.add(item.userId);
                    }
                });
            });
        };
        const collectUids1 = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const clubsTeamTable = doc.data()[key] || [];
                const clubsteam = doc.data()['clubsteam'] || [];
                if (clubsTeamTable[1]) {
                    const fieldName = clubsTeamTable[1].fn;
                    clubsteam.forEach((clubItem) => {
                        if (clubItem[fieldName]) {
                            followingUids.add(clubItem[fieldName]);
                        }
                    });
                }
            });
        };
        // Collecting following UIDs
        const followingSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("following").get();
        collectUids(followingSnapshot, 'following');
        const clubSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("clubs").get();
        collectUids(clubSnapshot, 'clubs');
        const profesSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("professionals").get();
        collectUids(profesSnapshot, 'professionals');
        const fromclubSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("fans").get();
        collectUids(fromclubSnapshot, 'fans');
        const fromprofeSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("fans").get();
        collectUids(fromprofeSnapshot, 'fans');
        const fromclubteamSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("clubsteam").get();
        collectUids1(fromclubteamSnapshot, 'clubsTeamTable');
        const fromprofetSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("trustedaccounts").get();
        collectUids(fromprofetSnapshot, 'accounts');
        const fromprofeclubSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("club").get();
        fromprofeclubSnapshot.forEach((doc) => {
            if (doc.id) {
                followingUids.add(doc.id);
            }
        });
        // Fetch user data for current user
        const sendClubNotification = async (userData) => {
            if (userData !== undefined) {
                const token = userData.token;
                const userId = userData.userId;
                if (token) {
                    if (userId === currentUserUid) {
                        const message = {
                            notification: {
                                title: 'New post',
                                body: 'New post upload complete',
                            },
                            data: {
                                click_action: "FLUTTER_NOTIFICATION_CLICK",
                                tab: "/Posts",
                                d: post.postId || '' // Ensure this field is defined
                            },
                            android: {
                                notification: {
                                    sound: "default",
                                    image: imageurl || '', // Ensure this field is defined
                                },
                            },
                            token,
                        };
                        await sendANotification(message);
                    }
                }
            }
        };
        const userData = await fetchUserData(currentUserUid);
        if (post.captionUrl && post.captionUrl.length > 0) {
            imageurl = post.captionUrl[0].url || ''; // Ensure this field is defined
        }
        await sendClubNotification(userData);
        const useruids = Array.from(followingUids).filter(uid => uid !== currentUserUid);
        const registrationTokens = [];
        const usersData = [];
        // Fetch FCM tokens for all following users
        const promises = useruids.map(async (followerId) => {
            const userData = await fetchUserData(followerId);
            if (userData !== undefined) {
                registrationTokens.push(userData.token);
                usersData.push({
                    userId: userData.userId,
                    userRef: userData.docRef,
                });
            }
        });
        await Promise.all(promises);
        // Subscribe the devices to the topic
        const topic = 'posts_notifications' + currentUserUid;
        const message = {
            notification: {
                title: 'New post',
                body: `Check out the latest post from ${userData.username}`,
            },
            topic: topic,
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                tab: "/Posts",
                d: post.postId || '' // Ensure this field is defined
            },
            android: {
                notification: {
                    sound: "default",
                    image: imageurl || '', // Ensure this field is defined
                },
            },
        };
        const uniquetokens = Array.from(new Set(registrationTokens)).filter(Boolean);
        await sendAllNotification(uniquetokens, message, topic);
        await addAllNotifications(usersData, currentUserUid, post.postId, "added a new post");
        return true;
    }
    catch (error) {
        console.error('Error sending notifications:', error);
        return false;
    }
});
exports.sendFansTvNotifications = functions.runWith({
    // memory: '1GB',
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).firestore
    .document('FansTv/{postId}')
    .onCreate(async (snap) => {
    try {
        const post = snap.data();
        const currentUserUid = post.authorId;
        const thumbnails = false;
        if (thumbnails) {
            try {
                if (post.url) {
                    const newThumbnail = await generateAndUploadThumbnail(post.url);
                    snap.ref.update({ thumbnail: newThumbnail });
                }
                else {
                    console.log("error: url does not exist");
                }
            }
            catch (e) {
                console.log("error:" + e);
            }
        }
        // Send notification to author's followers
        const followingUids = new Set();
        let imageurl = '';
        let name = '';
        const collectUids = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const followingData = doc.data()[key];
                followingData.forEach((item) => {
                    if (item.userId) {
                        followingUids.add(item.userId);
                    }
                });
            });
        };
        const collectUids1 = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const clubsTeamTable = doc.data()[key] || [];
                const clubsteam = doc.data()['clubsteam'] || [];
                if (clubsTeamTable[1]) {
                    const fieldName = clubsTeamTable[1].fn;
                    clubsteam.forEach((clubItem) => {
                        if (clubItem[fieldName]) {
                            followingUids.add(clubItem[fieldName]);
                        }
                    });
                }
            });
        };
        // Collecting following UIDs
        const followingSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("following").get();
        collectUids(followingSnapshot, 'following');
        const clubSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("clubs").get();
        collectUids(clubSnapshot, 'clubs');
        const profesSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("professionals").get();
        collectUids(profesSnapshot, 'professionals');
        const fromclubSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("fans").get();
        collectUids(fromclubSnapshot, 'fans');
        const fromprofeSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("fans").get();
        collectUids(fromprofeSnapshot, 'fans');
        const fromclubteamSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("clubsteam").get();
        collectUids1(fromclubteamSnapshot, 'clubsTeamTable');
        const fromprofetSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("trustedaccounts").get();
        collectUids(fromprofetSnapshot, 'accounts');
        const fromprofeclubSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("club").get();
        fromprofeclubSnapshot.forEach((doc) => {
            if (doc.id) {
                followingUids.add(doc.id);
            }
        });
        // Fetch user data for current user
        // Send notification to the other club
        const sendClubNotification = async (userData) => {
            if (userData !== undefined) {
                const userId = userData.userId;
                imageurl = userData.profileImage;
                name = userData.username;
                const token = userData.token;
                if (token) {
                    if (userId === currentUserUid) {
                        const message = {
                            notification: {
                                title: 'New video',
                                body: `New video upload complete`,
                            },
                            data: {
                                click_action: "FLUTTER_NOTIFICATION_CLICK",
                                tab: "/FansTv",
                                d: post.postId
                            },
                            android: {
                                notification: {
                                    sound: "default",
                                    image: '',
                                },
                            },
                            token,
                        };
                        await sendANotification(message);
                    }
                }
            }
        };
        const userData = await fetchUserData(currentUserUid);
        await sendClubNotification(userData);
        const useruids = Array.from(followingUids).filter(uid => uid !== currentUserUid);
        const registrationTokens = [];
        const usersData = [];
        // Fetch FCM tokens for all following users
        const promises = useruids.map(async (followerId) => {
            const userData = await fetchUserData(followerId);
            if (userData !== undefined) {
                registrationTokens.push(userData.token);
                usersData.push({
                    userId: userData.userId,
                    userRef: userData.docRef,
                });
            }
        });
        await Promise.all(promises);
        // Subscribe the devices to the topic
        const topic = 'fanstv_notifications' + currentUserUid;
        const message = {
            notification: {
                title: 'New video',
                body: `Check out the latest video from ${name}`,
            },
            topic: topic,
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                tab: "/FansTv",
                d: post.postId
            },
            android: {
                notification: {
                    sound: "default",
                    image: imageurl,
                },
            },
        };
        const uniquetokens = Array.from(new Set(registrationTokens)).filter(Boolean);
        await sendAllNotification(uniquetokens, message, topic);
        await addAllNotifications(usersData, currentUserUid, post.postId, "added a new video");
        return true;
    }
    catch (error) {
        console.error('Error sending notifications:', error);
        return false;
    }
});
//matches send notification
const getMessaging = admin.messaging();
exports.sendMatchNotifications = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).firestore
    .document('Matches/{matchId}')
    .onCreate(async (snap) => {
    try {
        const post = snap.data();
        const currentUserUid = post.authorId;
        const club1Id = post.club1Id;
        const club2Id = post.club2Id;
        // Send notification to author's followers
        const followingUids = new Set();
        //let imageurl = '';
        //let name = '';
        const collectUids = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const followingData = doc.data()[key];
                followingData.forEach((item) => {
                    if (item.userId) {
                        followingUids.add(item.userId);
                    }
                });
            });
        };
        const collectUids1 = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const clubsTeamTable = doc.data()[key] || [];
                const clubsteam = doc.data()['clubsteam'] || [];
                if (clubsTeamTable[1]) {
                    const fieldName = clubsTeamTable[1].fn;
                    clubsteam.forEach((clubItem) => {
                        if (clubItem[fieldName]) {
                            followingUids.add(clubItem[fieldName]);
                        }
                    });
                }
            });
        };
        // Collecting following UIDs
        const followingSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("following").get();
        collectUids(followingSnapshot, 'following');
        const clubSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("clubs").get();
        collectUids(clubSnapshot, 'clubs');
        const profesSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("professionals").get();
        collectUids(profesSnapshot, 'professionals');
        const fromclubSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("fans").get();
        collectUids(fromclubSnapshot, 'fans');
        const fromprofeSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("fans").get();
        collectUids(fromprofeSnapshot, 'fans');
        const fromclubteamSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("clubsteam").get();
        collectUids1(fromclubteamSnapshot, 'clubsTeamTable');
        const fromprofetSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("trustedaccounts").get();
        collectUids(fromprofetSnapshot, 'accounts');
        const fromprofeclubSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("club").get();
        fromprofeclubSnapshot.forEach((doc) => {
            if (doc.id) {
                followingUids.add(doc.id);
            }
        });
        // Fetch user data for current user
        const userDataA = await fetchUserData(currentUserUid);
        // Send notification to the other club
        const sendClubNotification = async (userData) => {
            try {
                if (userData !== undefined) {
                    const userId = userData.userId;
                    const token = userData.token;
                    if (token) {
                        if (userId === currentUserUid) {
                            const message = {
                                notification: {
                                    title: 'New match',
                                    body: `You have succeded in adding a new match`,
                                },
                                data: {
                                    click_action: "FLUTTER_NOTIFICATION_CLICK",
                                    tab: "/Matches",
                                    d: post.matchId
                                },
                                android: {
                                    notification: {
                                        sound: "default",
                                        image: "",
                                    },
                                },
                                token,
                            };
                            await sendANotification(message);
                            console.log("sent to author successfully");
                        }
                        else {
                            const message = {
                                notification: {
                                    title: 'New match',
                                    body: `${userDataA.username} added you to their new match`,
                                },
                                data: {
                                    click_action: "FLUTTER_NOTIFICATION_CLICK",
                                    tab: "/Matches",
                                    d: post.matchId
                                },
                                android: {
                                    notification: {
                                        sound: "default",
                                        image: "",
                                    },
                                },
                                token,
                            };
                            await addANotification(userData.docRef, currentUserUid, userId, post.matchId, "added you to their new match");
                            await sendANotification(message);
                            console.log("sent to user1 successfully");
                        }
                    }
                }
            }
            catch (error) {
                console.error("error:", error);
            }
        };
        const club1Data = await fetchUserData(club1Id);
        const club2Data = await fetchUserData(club2Id);
        await sendClubNotification(club1Data);
        await sendClubNotification(club2Data);
        const useruids = Array.from(followingUids).filter(uid => uid !== currentUserUid);
        const registrationTokens = [];
        const usersData = [];
        // Fetch FCM tokens for all following users
        const promises = useruids.map(async (followerId) => {
            const userData = await fetchUserData(followerId);
            if (userData !== undefined) {
                registrationTokens.push(userData.token);
                usersData.push({
                    userId: userData.userId,
                    userRef: userData.docRef,
                });
            }
        });
        await Promise.all(promises);
        // Subscribe the devices to the topic
        const topic = 'match_notifications' + currentUserUid;
        const message = {
            notification: {
                title: 'New match',
                body: `${userDataA.username} added a new match`,
            },
            topic: topic,
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                tab: "/Matches",
                d: post.matchId
            },
            android: {
                notification: {
                    sound: "default",
                    image: "",
                },
            },
        };
        const uniquetokens = Array.from(new Set(registrationTokens)).filter(Boolean);
        await sendAllNotification(uniquetokens, message, topic);
        await addAllNotifications(usersData, currentUserUid, post.matchId, "added a new match");
        return true;
    }
    catch (error) {
        console.error('Error sending notifications:', error);
        return false;
    }
});
async function sendAllNotification(tokens, message, topic) {
    try {
        await getMessaging.subscribeToTopic(tokens, topic);
        console.log('Successfully subscribed to topic:', topic);
        if (tokens) {
            await getMessaging.send(message);
        }
    }
    catch (error) {
        console.error("error:", error);
    }
}
async function addAllNotifications(userRefs, from, content, message) {
    const notificationsPromises = userRefs.map(async (userdata) => {
        const querySnapshot = await userdata.userRef.collection("notifications").orderBy('createdAt', 'desc').limit(1).get();
        const latestDoc = querySnapshot.docs[0];
        let allNotifications = [];
        let isNewDocument = true;
        if (!querySnapshot.empty) {
            const latestData = latestDoc.data();
            allNotifications = (latestData === null || latestData === void 0 ? void 0 : latestData.notifications) || [];
            // Check if the latest document is under the size limit
            if (allNotifications.length < 5000) {
                isNewDocument = false;
            }
        }
        // Generate a random notification ID
        const notifiId = generateRandomUid(28);
        // Create the new notification object
        const notification = {
            'NotifiId': notifiId,
            'from': from,
            'to': userdata.userId,
            'message': message,
            'content': content,
            'createdAt': admin.firestore.Timestamp.now(),
        };
        if (isNewDocument) {
            // If a new document is needed or the latest document doesn't exist
            await userdata.userRef.collection('notifications').add({
                notifications: [notification],
                createdAt: admin.firestore.Timestamp.now(),
                // Add other necessary fields
            });
        }
        else {
            // If the latest document exists and is under the size limit, update it
            await latestDoc.ref.update({
                notifications: [...allNotifications, notification],
                // Add other necessary fields
            });
        }
    });
    await Promise.all(notificationsPromises);
}
async function addANotification(userRef, from, to, content, message) {
    // Get the latest document in the notifications collection
    const querySnapshot = await userRef
        .collection("notifications").orderBy('createdAt', 'desc').limit(1).get();
    const latestDoc = querySnapshot.docs[0];
    let allNotifications = [];
    let isNewDocument = true;
    if (!querySnapshot.empty) {
        const latestData = latestDoc.data();
        allNotifications = (latestData === null || latestData === void 0 ? void 0 : latestData.notifications) || [];
        // Check if the latest document is under the size limit
        if (allNotifications.length < 5000) {
            isNewDocument = false;
        }
    }
    // Generate a random notification ID
    const notifiId = generateRandomUid(28);
    // Create the new notification object
    const notification = {
        'NotifiId': notifiId,
        'from': from,
        'to': to,
        'message': message,
        'content': content,
        'createdAt': admin.firestore.Timestamp.now(),
    };
    if (isNewDocument) {
        // If a new document is needed or the latest document doesn't exist
        await userRef.collection('notifications').add({
            notifications: [notification],
            createdAt: admin.firestore.Timestamp.now(),
            // Add other necessary fields
        });
    }
    else {
        // If the latest document exists and is under the size limit, update it
        await latestDoc.ref.update({
            notifications: [...allNotifications, notification],
            // Add other necessary fields
        });
    }
}
async function sendANotification(message) {
    try {
        await admin.messaging().send(message);
    }
    catch (error) {
        console.error("error", error);
    }
}
//events notifications
exports.sendeventNotifications = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).firestore
    .document('Events/{eventId}')
    .onCreate(async (snap) => {
    try {
        const post = snap.data();
        const currentUserUid = post.authorId;
        // Send notification to author's followers
        const followingUids = new Set();
        //let imageurl = '';
        //let name = '';
        const collectUids = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const followingData = doc.data()[key];
                followingData.forEach((item) => {
                    if (item.userId) {
                        followingUids.add(item.userId);
                    }
                });
            });
        };
        const collectUids1 = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const clubsTeamTable = doc.data()[key] || [];
                const clubsteam = doc.data()['clubsteam'] || [];
                if (clubsTeamTable[1]) {
                    const fieldName = clubsTeamTable[1].fn;
                    clubsteam.forEach((clubItem) => {
                        if (clubItem[fieldName]) {
                            followingUids.add(clubItem[fieldName]);
                        }
                    });
                }
            });
        };
        // Collecting following UIDs
        const followingSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("following").get();
        collectUids(followingSnapshot, 'following');
        const clubSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("clubs").get();
        collectUids(clubSnapshot, 'clubs');
        const profesSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("professionals").get();
        collectUids(profesSnapshot, 'professionals');
        const fromclubSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("fans").get();
        collectUids(fromclubSnapshot, 'fans');
        const fromprofeSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("fans").get();
        collectUids(fromprofeSnapshot, 'fans');
        const fromclubteamSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("clubsteam").get();
        collectUids1(fromclubteamSnapshot, 'clubsTeamTable');
        const fromprofetSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("trustedaccounts").get();
        collectUids(fromprofetSnapshot, 'accounts');
        const fromprofeclubSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("club").get();
        fromprofeclubSnapshot.forEach((doc) => {
            if (doc.id) {
                followingUids.add(doc.id);
            }
        });
        // Fetch user data for current user
        // Send notification to the other club
        const userData = await fetchUserData(currentUserUid);
        const token = userData.token;
        if (token) {
            const message = {
                notification: {
                    title: 'New event',
                    body: `You have succeded in adding a new event`,
                },
                data: {
                    click_action: "FLUTTER_NOTIFICATION_CLICK",
                    tab: "/Events",
                    d: post.eventId
                },
                android: {
                    notification: {
                        sound: "default",
                        image: "",
                    },
                },
                token,
            };
            await sendANotification(message);
        }
        const useruids = Array.from(followingUids).filter(uid => uid !== currentUserUid);
        const registrationTokens = [];
        const usersData = [];
        // Fetch FCM tokens for all following users
        const promises = useruids.map(async (followerId) => {
            const userData = await fetchUserData(followerId);
            if (userData !== undefined) {
                registrationTokens.push(userData.token);
                usersData.push({
                    userId: userData.userId,
                    userRef: userData.docRef,
                });
            }
        });
        await Promise.all(promises);
        // Subscribe the devices to the topic
        const topic = 'event_notifications' + currentUserUid;
        const message = {
            notification: {
                title: 'New event',
                body: `${userData.username} added a new event`,
            },
            topic: topic,
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                tab: "/Events",
                d: post.eventId
            },
            android: {
                notification: {
                    sound: "default",
                    image: userData.profileImage || "",
                },
            },
        };
        const uniquetokens = Array.from(new Set(registrationTokens)).filter(Boolean);
        await sendAllNotification(uniquetokens, message, topic);
        await addAllNotifications(usersData, currentUserUid, post.eventId, "added a new event");
        return true;
    }
    catch (error) {
        console.error('Error sending notifications:', error);
        return false;
    }
});
//story notifications
exports.sendStoryNotifications = functions.runWith({
    // memory: '1GB',
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).firestore
    .document('Story/{StoryId}')
    .onCreate(async (snap) => {
    try {
        const post = snap.data();
        const currentUserUid = post.authorId;
        const stories = post.story;
        const thumbnails = false;
        if (thumbnails) {
            const updatedStories = await Promise.all(stories.map(async (story) => {
                // Check if the thumbnail is empty or missing
                if (!story.thumbnail || story.thumbnail == undefined) {
                    const videoUrl = story.url;
                    if (!videoUrl || !videoUrl.startsWith('http')) {
                        console.error(`Invalid video URL: ${videoUrl}`);
                        return story; // Return the story unchanged
                    }
                    // Generate and upload the thumbnail
                    try {
                        const newThumbnail = await generateAndUploadThumbnail(videoUrl);
                        return Object.assign(Object.assign({}, story), { thumbnail: newThumbnail }); // Update the story with the new thumbnail
                    }
                    catch (error) {
                        console.error(`Error generating thumbnail for story: ${story.storyId}`, error);
                        return story; // Return the story unchanged
                    }
                }
                return story; // Return the story unchanged if thumbnail exists
            }));
            // Update the document with the updated stories array
            await snap.ref.update({ story: updatedStories });
        }
        // Send notification to author's followers
        const followingUids = new Set();
        let imageurl = '';
        //let name = '';
        const collectUids = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const followingData = doc.data()[key];
                followingData.forEach((item) => {
                    if (item.userId) {
                        followingUids.add(item.userId);
                    }
                });
            });
        };
        const collectUids1 = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const clubsTeamTable = doc.data()[key] || [];
                const clubsteam = doc.data()['clubsteam'] || [];
                if (clubsTeamTable[1]) {
                    const fieldName = clubsTeamTable[1].fn;
                    clubsteam.forEach((clubItem) => {
                        if (clubItem[fieldName]) {
                            followingUids.add(clubItem[fieldName]);
                        }
                    });
                }
            });
        };
        // Collecting following UIDs
        const followingSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("following").get();
        collectUids(followingSnapshot, 'following');
        const clubSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("clubs").get();
        collectUids(clubSnapshot, 'clubs');
        const profesSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("professionals").get();
        collectUids(profesSnapshot, 'professionals');
        const fromclubSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("fans").get();
        collectUids(fromclubSnapshot, 'fans');
        const fromprofeSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("fans").get();
        collectUids(fromprofeSnapshot, 'fans');
        const fromclubteamSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("clubsteam").get();
        collectUids1(fromclubteamSnapshot, 'clubsTeamTable');
        const fromprofetSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("trustedaccounts").get();
        collectUids(fromprofetSnapshot, 'accounts');
        const fromprofeclubSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("club").get();
        fromprofeclubSnapshot.forEach((doc) => {
            if (doc.id) {
                followingUids.add(doc.id);
            }
        });
        // Fetch user data for current user
        const userData = await fetchUserData(currentUserUid);
        const token = userData.token;
        if (post.story.length > 0 || post.story !== undefined) {
            imageurl = post.story[0].url1;
        }
        if (token) {
            const message = {
                notification: {
                    title: 'New story',
                    body: `Uploading story complete`,
                },
                data: {
                    click_action: "FLUTTER_NOTIFICATION_CLICK",
                    tab: "/Stories",
                    d: post.StoryId
                },
                android: {
                    notification: {
                        sound: "default",
                        image: imageurl,
                    },
                },
                token,
            };
            await sendANotification(message);
        }
        ;
        const useruids = Array.from(followingUids).filter(uid => uid !== currentUserUid);
        const registrationTokens = [];
        const usersData = [];
        // Fetch FCM tokens for all following users
        const promises = useruids.map(async (followerId) => {
            const userData = await fetchUserData(followerId);
            if (userData !== undefined) {
                registrationTokens.push(userData.token);
                usersData.push({
                    userId: userData.userId,
                    userRef: userData.docRef,
                });
            }
        });
        await Promise.all(promises);
        // Subscribe the devices to the topic
        const topic = 'story_notifications' + currentUserUid;
        const message = {
            notification: {
                title: 'New story',
                body: `${userData.username} shared a story`,
            },
            topic: topic,
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                tab: "/Stories",
                d: post.StoryId
            },
            android: {
                notification: {
                    sound: "default",
                    image: imageurl || "",
                },
            },
        };
        const uniquetokens = Array.from(new Set(registrationTokens)).filter(Boolean);
        await sendAllNotification(uniquetokens, message, topic);
        await addAllNotifications(usersData, currentUserUid, post.eventId, "shared a story");
        return true;
    }
    catch (error) {
        console.error('Error sending notifications:', error);
        return false;
    }
});
exports.sendHighlightNotifications = functions.runWith({
    // memory: '1GB',
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).firestore
    .document('Highlights/{docId}')
    .onCreate(async (snap) => {
    try {
        const post = snap.data();
        const currentUserUid = post.docId;
        const highlights = post.highlights;
        const thumbnails = false;
        if (thumbnails) {
            const updatedHighlights = await Promise.all(highlights.map(async (highlight) => {
                const urls = highlight.urls;
                if (!Array.isArray(urls) || urls.length === 0) {
                    console.error(`Invalid or empty urls field in highlight: ${highlight.highlightId}`);
                    return highlight; // Skip invalid highlights
                }
                const updatedUrls = await Promise.all(urls.map(async (url) => {
                    // Check if the URL is a video (.mp4)
                    if (typeof url === "string" && url.includes(".mp4")) {
                        try {
                            const newThumbnail = await generateAndUploadThumbnail(url);
                            console.log(`Generated thumbnail for video: ${url}`);
                            return { url: url, thumbnail: newThumbnail }; // Return as a map with URL and thumbnail
                        }
                        catch (error) {
                            console.error(`Error generating thumbnail for video: ${url}`, error);
                            return { url: url }; // Return only the URL if thumbnail generation fails
                        }
                    }
                    else if (typeof url === "string") {
                        // Return non-video URLs unchanged
                        return { url: url };
                    }
                    else {
                        return url; // Keep original format if not a string
                    }
                }));
                // Update the highlight's URLs array with the processed URLs
                return Object.assign(Object.assign({}, highlight), { urls: updatedUrls });
            }));
            // Update the document with the updated highlights array
            await snap.ref.update({ highlights: updatedHighlights });
        }
        // Send notification to author's followers
        const followingUids = new Set();
        let imageurl = '';
        //let name = '';
        const collectUids = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const followingData = doc.data()[key];
                followingData.forEach((item) => {
                    if (item.userId) {
                        followingUids.add(item.userId);
                    }
                });
            });
        };
        const collectUids1 = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const clubsTeamTable = doc.data()[key] || [];
                const clubsteam = doc.data()['clubsteam'] || [];
                if (clubsTeamTable[1]) {
                    const fieldName = clubsTeamTable[1].fn;
                    clubsteam.forEach((clubItem) => {
                        if (clubItem[fieldName]) {
                            followingUids.add(clubItem[fieldName]);
                        }
                    });
                }
            });
        };
        // Collecting following UIDs
        const followingSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("following").get();
        collectUids(followingSnapshot, 'following');
        const clubSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("clubs").get();
        collectUids(clubSnapshot, 'clubs');
        const profesSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("professionals").get();
        collectUids(profesSnapshot, 'professionals');
        const fromclubSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("fans").get();
        collectUids(fromclubSnapshot, 'fans');
        const fromprofeSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("fans").get();
        collectUids(fromprofeSnapshot, 'fans');
        const fromclubteamSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("clubsteam").get();
        collectUids1(fromclubteamSnapshot, 'clubsTeamTable');
        const fromprofetSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("trustedaccounts").get();
        collectUids(fromprofetSnapshot, 'accounts');
        const fromprofeclubSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("club").get();
        fromprofeclubSnapshot.forEach((doc) => {
            if (doc.id) {
                followingUids.add(doc.id);
            }
        });
        // Fetch user data for current user
        const userData = await fetchUserData(currentUserUid);
        const token = userData.token;
        if (post.story.length > 0 || post.story !== undefined) {
            imageurl = post.story[0].url1;
        }
        if (token) {
            const message = {
                notification: {
                    title: 'New highlight',
                    body: `Uploading highlight complete`,
                },
                data: {
                    click_action: "FLUTTER_NOTIFICATION_CLICK",
                    tab: "/Highlight",
                    d: post.StoryId
                },
                android: {
                    notification: {
                        sound: "default",
                        image: imageurl,
                    },
                },
                token,
            };
            await sendANotification(message);
        }
        ;
        const useruids = Array.from(followingUids).filter(uid => uid !== currentUserUid);
        const registrationTokens = [];
        const usersData = [];
        // Fetch FCM tokens for all following users
        const promises = useruids.map(async (followerId) => {
            const userData = await fetchUserData(followerId);
            if (userData !== undefined) {
                registrationTokens.push(userData.token);
                usersData.push({
                    userId: userData.userId,
                    userRef: userData.docRef,
                });
            }
        });
        await Promise.all(promises);
        // Subscribe the devices to the topic
        const topic = 'Highlight_notifications' + currentUserUid;
        const message = {
            notification: {
                title: 'New highlight',
                body: `${userData.username} shared a highlight`,
            },
            topic: topic,
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                tab: "/Highlight",
                d: post.StoryId
            },
            android: {
                notification: {
                    sound: "default",
                    image: imageurl || "",
                },
            },
        };
        const uniquetokens = Array.from(new Set(registrationTokens)).filter(Boolean);
        await sendAllNotification(uniquetokens, message, topic);
        await addAllNotifications(usersData, currentUserUid, post.eventId, "shared a highlight");
        return true;
    }
    catch (error) {
        console.error('Error sending notifications:', error);
        return false;
    }
});
//welcome notificationSSSS
exports.sendWelcomeNotification1 = functions.firestore
    .document('Clubs/{Clubid}')
    .onCreate(async (snap) => {
    try {
        const post = snap.data();
        const token = post.fcmToken;
        const email = post.email;
        const Clubname = post.Clubname;
        // Sending FCM notification
        const message = {
            notification: {
                title: 'Welcome to Fans Arena',
                body: 'You signed up as a Club, ' + post.Clubname,
            },
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                tab: '/home',
                d: email
            },
            android: {
                notification: {
                    sound: "default",
                    image: "https://res.cloudinary.com/startup-grind/image/upload/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/DF22-Bevy-EventThumb%402x_7wlrADr.png",
                },
            },
            token,
        };
        if (token) {
            await admin.messaging().send(message);
            if (!email || Clubname) {
                console.log("email or clubname empty or undefined");
            }
            try {
                sendEmail(email, Clubname, "Club");
            }
            catch (e) {
                console.log("error:", e);
            }
        }
        // Sending welcome email
        console.log('FCM notification sent successfully');
    }
    catch (error) {
        console.error('Error sending notifications:', error);
    }
});
//emailApi
const sendEmail = async (usermail, username, collection) => {
    const url = "https://api.mailersend.com/v1/email";
    const agoraapis = await admin.firestore().collection("APIS").doc("api").get();
    const data = agoraapis.data();
    let token = ""; // Replace with your actual MailerSend API token
    if (data != undefined) {
        token = data.emailApi;
    }
    // Map account type to role-specific functionalities
    const roleDescriptions = {
        Fan: `As a <strong>Fan</strong>, you are the heartbeat of the arena! You can:
      <ul style='text-align: left;'>
        <li>Watch live matches from your favorite local teams. No more rumours and speculations to what happened now you can view</li>
        <li>Like, comment, and share your thoughts on exciting moments.</li>
        <li>Post videos and images to celebrate your favorite teams and players.</li>
      </ul>`,
        Club: `As a <strong>Club</strong>, you have the power to:
      <ul style='text-align: left;'>
        <li>Create and manage a team of players.</li>
        <li>Organize and broadcast matches live for your fans.</li>
        <li>Engage with your audience and grow your club's presence.</li>
      </ul>`,
        Professional: `As a <strong>Professional</strong>, you can:
      <ul style='text-align: left;'>
        <li>Create and manage leagues, inviting teams to participate.</li>
        <li>Organize matches for league members and broadcast them live.</li>
        <li>Set up contests and create unforgettable moments for players and fans alike.</li>
        <li>Part of a team as player of a club.</li>
      </ul>`
    };
    const message = "You Signed Up as " + collection;
    const roleDescription = roleDescriptions[collection] || "Welcome to Fans Arena! Explore the platform and enjoy our features.";
    ;
    const payload = {
        from: {
            email: "info@fansarenakenya.site", // Replace with your sender email
        },
        to: [
            {
                email: usermail, // Replace with the recipient email
            },
        ],
        subject: `Hello, ${username}! Welcome to Fans Arena!`,
        text: "You Signed Up as " + collection,
        html: `
      <div style="font-family: Arial, sans-serif; text-align: center;">
        <img src="https://firebasestorage.googleapis.com/v0/b/fans-arena.appspot.com/o/Posts%2Fimages%2F1721637929628.jpg?alt=media&token=2bb7c202-6c8f-495e-af3f-585e32b2b261" alt="Fans Arena Logo" style="width: 150px; margin-bottom: 20px;" />
        <h1 style="font-size: 24px; color: #333;">
          Welcome to 
          <span style="color: yellow;">F</span>ans
          <span style="color: orange;">A</span>rena!
        </h1>
        <p style="font-size: 16px; color: #555;">
          Greetings from the Fans Arena team! We are excited to have you onboard.
        </p>
         <p style="font-size: 16px; color: #555;">
          ${message}
        </p>
        <p style="font-size: 16px; color: #555;">
          ${roleDescription}
        </p>
        <p style="font-size: 14px; color: #777; margin-top: 20px;">
          Regards,<br/>
          Fans Arena Team
        </p>
      </div>
    `,
    };
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const error = await response.json();
            console.error("Error sending email:", error);
            console.log(`Failed to send email: ${response.statusText}`);
            throw new Error(`Failed to send email: ${response.statusText}`);
        }
        const result = await response.json();
        console.log("Email sent successfully:", result);
    }
    catch (error) {
        console.error("Error occurred:", error);
    }
};
// Call the function
exports.sendWelcomeNotification2 = functions.firestore
    .document('Professionals/{profeid}')
    .onCreate(async (snap) => {
    try {
        const post = snap.data();
        const token = post.fcmToken;
        const email = post.email;
        const Stagename = post.Stagename;
        sendEmail(email, Stagename, "Professional");
        //Fcm
        const message = {
            notification: {
                title: 'Welcome to Fans Arena',
                body: 'You signed up as a Professional, ' + post.Stagename,
            },
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                tab: '/home',
                d: email,
            },
            android: {
                notification: {
                    sound: "default",
                    image: "https://res.cloudinary.com/startup-grind/image/upload/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/DF22-Bevy-EventThumb%402x_7wlrADr.png",
                },
            },
            token,
        };
        if (token) {
            await admin.messaging().send(message);
        }
        console.log('FCM notification sent successfully');
    }
    catch (error) {
        console.error('Error sending notifications:', error);
    }
});
exports.senddripaWelcomeNotification1 = functions.firestore
    .document('Passenger/{userId}')
    .onCreate(async (snap) => {
    try {
        const post = snap.data();
        const token = post.fcmToken;
        const email = post.email;
        //Fcm
        const message = {
            notification: {
                title: 'Welcome to Dripa',
                body: 'You for signed up as a passenger, ' + post.username,
            },
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                tab: '/home',
                d: email,
            },
            android: {
                notification: {
                    sound: "default",
                    image: "https://res.cloudinary.com/startup-grind/image/upload/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/DF22-Bevy-EventThumb%402x_7wlrADr.png",
                },
            },
            token,
        };
        if (token) {
            await admin.messaging().send(message);
        }
        const sentFrom = new mailersend_1.Sender("dripakenya@gmail.com", "Dripa");
        const recipients = [new mailersend_1.Recipient(email, post.username)];
        const emailParams = new mailersend_1.EmailParams()
            .setFrom(sentFrom)
            .setTo(recipients)
            .setSubject('Welcome to Dripa')
            .setHtml(`<strong>Greetings ${post.username}, thank you for signing up as a Passenger at Dripa.<strong>`)
            .setText(`Greetings ${post.username}, thank you for signing up as a Passenger at Dripa.`);
        await mailersend.email.send(emailParams);
        console.log('Welcome email sent successfully');
        console.log('FCM notification sent successfully');
    }
    catch (error) {
        console.error('Error sending notifications:', error);
    }
});
exports.senddripaWelcomeNotification2 = functions.firestore
    .document('Driver/{userId}')
    .onCreate(async (snap) => {
    try {
        const post = snap.data();
        const token = post.fcmToken;
        const email = post.email;
        //Fcm
        const message = {
            notification: {
                title: 'Welcome to Dripa',
                body: 'You for signed up as a Driver, ' + post.username,
            },
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                tab: '/home',
                d: email,
            },
            android: {
                notification: {
                    sound: "default",
                    image: "https://res.cloudinary.com/startup-grind/image/upload/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/DF22-Bevy-EventThumb%402x_7wlrADr.png",
                },
            },
            token,
        };
        if (token) {
            await admin.messaging().send(message);
        }
        const sentFrom = new mailersend_1.Sender("dripakenya@gmail.com", "Dripa");
        const recipients = [new mailersend_1.Recipient(email, post.username)];
        const emailParams = new mailersend_1.EmailParams()
            .setFrom(sentFrom)
            .setTo(recipients)
            .setSubject('Welcome to Dripa')
            .setHtml(`<strong>Greetings ${post.username}, thank you for signing up as a Driver at Dripa.<strong>`)
            .setText(`Greetings ${post.username}, thank you for signing up as a Driver at Dripa.`);
        await mailersend.email.send(emailParams);
        console.log('Welcome email sent successfully');
        console.log('FCM notification sent successfully');
    }
    catch (error) {
        console.error('Error sending notifications:', error);
    }
});
exports.sendWelcomeNotification3 = functions.firestore
    .document('Fans/{Fanid}')
    .onCreate(async (snap) => {
    try {
        const post = snap.data();
        const token = post.fcmToken;
        const email = post.email;
        const username = post.username;
        sendEmail(email, username, "Fan");
        //fcm
        const message = {
            notification: {
                title: 'Welcome to Fans Arena',
                body: 'You signed up as a Fan, ' + post.username,
            },
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                tab: '/home',
                d: email,
            },
            android: {
                notification: {
                    sound: "default",
                    image: "https://res.cloudinary.com/startup-grind/image/upload/c_fill,dpr_2.0,f_auto,g_center,q_auto:good/v1/gcs/platform-data-goog/events/DF22-Bevy-EventThumb%402x_7wlrADr.png",
                },
            },
            token,
        };
        if (token) {
            await admin.messaging().send(message);
        }
        console.log('FCM notification sent successfully');
    }
    catch (error) {
        console.error('Error sending notifications:', error);
    }
});
//send notification to show event started
exports.sendOnliveNotifications = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https
    .onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const currentUserUid = queryParams["uid"];
        const matchId = queryParams["eventId"];
        const event = queryParams["event"];
        const messag = queryParams["message"];
        if (!currentUserUid || !matchId) {
            response.status(400).json({ error: "uid and eventId are required" });
            return;
        }
        // Send notification to author's followers
        const followingUids = new Set();
        let imageurl = '';
        let name = '';
        const collectUids = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const followingData = doc.data()[key];
                followingData.forEach((item) => {
                    if (item.userId) {
                        followingUids.add(item.userId);
                    }
                });
            });
        };
        const collectUids1 = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const clubsTeamTable = doc.data()[key] || [];
                const clubsteam = doc.data()['clubsteam'] || [];
                if (clubsTeamTable[1]) {
                    const fieldName = clubsTeamTable[1].fn;
                    clubsteam.forEach((clubItem) => {
                        if (clubItem[fieldName]) {
                            followingUids.add(clubItem[fieldName]);
                        }
                    });
                }
            });
        };
        // Collecting following UIDs
        const followingSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("following").get();
        collectUids(followingSnapshot, 'following');
        const clubSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("clubs").get();
        collectUids(clubSnapshot, 'clubs');
        const profesSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("professionals").get();
        collectUids(profesSnapshot, 'professionals');
        const fromclubSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("fans").get();
        collectUids(fromclubSnapshot, 'fans');
        const fromprofeSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("fans").get();
        collectUids(fromprofeSnapshot, 'fans');
        const fromclubteamSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("clubsteam").get();
        collectUids1(fromclubteamSnapshot, 'clubsTeamTable');
        const fromprofetSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("trustedaccounts").get();
        collectUids(fromprofetSnapshot, 'accounts');
        const fromprofeclubSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("club").get();
        fromprofeclubSnapshot.forEach((doc) => {
            if (doc.id) {
                followingUids.add(doc.id);
            }
        });
        const useruids = Array.from(followingUids).filter(uid => uid !== currentUserUid);
        const registrationTokens = [];
        const usersData = [];
        // Fetch FCM tokens for all following users
        const promises = useruids.map(async (followerId) => {
            const userData = await fetchUserData(followerId);
            if (userData !== undefined) {
                registrationTokens.push(userData.token);
                usersData.push({
                    userId: userData.userId,
                    userRef: userData.docRef,
                });
            }
        });
        await Promise.all(promises);
        const userData = await fetchUserData(currentUserUid);
        // Subscribe the devices to the topic
        if (userData.profileImage !== undefined) {
            imageurl = userData.profileImage;
        }
        if (userData.username !== undefined) {
            name = userData.username;
        }
        const topic = 'event_notifications' + currentUserUid;
        const message = {
            notification: {
                title: `${event} ${messag}`,
                body: `${event} from ${name} ${messag}`,
            },
            topic: topic,
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                tab: "/Events",
                d: matchId
            },
            android: {
                notification: {
                    sound: "default",
                    image: imageurl || "",
                },
            },
        };
        const uniquetokens = Array.from(new Set(registrationTokens)).filter(Boolean);
        await sendAllNotification(uniquetokens, message, topic);
        await addAllNotifications(usersData, currentUserUid, matchId, `${event.toLowerCase()} ${messag}`);
    }
    catch (error) {
        console.error('Error sending notifications:', error);
        response.status(500).json({ error: "Internal server error" + error });
    }
});
//send notification to following
exports.sendfollowingNotifications = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https
    .onRequest(async (request, response) => {
    let username = '';
    let imageUrl = '';
    try {
        const queryParams = convertParsedQs(request.query);
        const currentUserUid = queryParams["uid1"];
        const otheruid = queryParams["uid2"];
        if (!currentUserUid || !otheruid) {
            response.status(400).json({ error: "User ID and other ID are required" });
            return;
        }
        // Fetch user data for the current user
        const currentUserSnapshot = await admin.firestore()
            .collection('Fans').doc(currentUserUid).get();
        if (!currentUserSnapshot.exists) {
            response.status(404).json({ error: "Current user not found" });
            return;
        }
        const currentUserData = currentUserSnapshot.data();
        if ((currentUserData === null || currentUserData === void 0 ? void 0 : currentUserData.profileimage) !== undefined) {
            imageUrl = currentUserData === null || currentUserData === void 0 ? void 0 : currentUserData.profileimage;
        }
        if ((currentUserData === null || currentUserData === void 0 ? void 0 : currentUserData.username) !== undefined) {
            username = currentUserData === null || currentUserData === void 0 ? void 0 : currentUserData.username;
        }
        // Send notification to the other user
        const otherUserSnapshot = await admin.firestore()
            .collection('Fans').doc(otheruid).get();
        if (otherUserSnapshot.exists) {
            const otherUserData = otherUserSnapshot.data();
            const token = otherUserData === null || otherUserData === void 0 ? void 0 : otherUserData.fcmToken;
            if (token) {
                const message = {
                    notification: {
                        title: 'New follower',
                        body: `${username} is now following you`,
                    },
                    data: {
                        click_action: "FLUTTER_NOTIFICATION_CLICK",
                        tab: "/Follower",
                    },
                    android: {
                        notification: {
                            sound: "default",
                            image: imageUrl,
                        },
                    },
                    token,
                };
                await sendANotification(message);
                await addANotification(otherUserSnapshot.ref, currentUserUid, otheruid, '', "is now following you");
            }
        }
        response.status(200).json({ success: true, message: " successfully" });
    }
    catch (error) {
        console.error('Error sending notifications:', error);
        response.status(500).json({ error: "Internal server error" + error });
    }
});
const sendEmail1 = async (usermail, username, collection) => {
    const url = "https://api.mailersend.com/v1/email";
    const agoraapis = await admin.firestore().collection("APIS").doc("api").get();
    const data = agoraapis.data();
    let token = ""; // Replace with your actual MailerSend API token
    if (data != undefined) {
        token = data.emailApi;
    }
    // Map account type to role-specific functionalities
    const roleDescriptions = {
        Fan: `As a <strong>Fan</strong>, you are the heartbeat of the arena! You can:
      <ul style='text-align: left;'>
        <li>Watch live matches from your favorite local teams\.<\/li>
        <li>Like, comment, and share your thoughts on exciting moments\.<\/li>
        <li>Post videos and images to celebrate your favorite teams and players\.<\/li>
        <li>No more rumors—be there by watching events unfold live\.<\/li>
      <\/ul>`,
        Club: `As a <strong>Club</strong>, you have the power to:
      <ul style='text-align: left;'>
        <li>Create and manage a team of players.</li>
        <li>Organize and broadcast matches live for your fans.</li>
        <li>Engage with your audience and grow your club's presence.</li>
      </ul>`,
        Professional: `As a <strong>Professional</strong>, you can:
      <ul style='text-align: left;'>
        <li>Create and manage leagues, inviting teams to participate.</li>
        <li>Organize matches for league members and broadcast them live.</li>
        <li>Set up contests and create unforgettable moments for players and fans alike.</li>
        <li>Be part of a team as a player of a club.</li>
      </ul>`
    };
    const message = "You logged in as " + collection;
    const roleDescription = roleDescriptions[collection] || "Welcome back to Fans Arena! Explore the platform and enjoy our features.";
    const payload = {
        from: {
            email: "info@fansarenakenya.site", // Replace with your sender email
        },
        to: [
            {
                email: usermail, // Replace with the recipient email
            },
        ],
        subject: `Hello, ${username}! Welcome Back to Fans Arena!`,
        text: "You logged in as " + collection,
        html: `
      <div style="font-family: Arial, sans-serif; text-align: center;">
        <img src="https://firebasestorage.googleapis.com/v0/b/fans-arena.appspot.com/o/Posts%2Fimages%2F1721637929628.jpg?alt=media&token=2bb7c202-6c8f-495e-af3f-585e32b2b261" alt="Fans Arena Logo" style="width: 150px; margin-bottom: 20px;" />
        <h1 style="font-size: 24px; color: #333;">
          Welcome Back to 
          <span style="color: yellow;">F</span>ans
          <span style="color: orange;">A</span>rena!
        </h1>
        <p style="font-size: 16px; color: #555;">
          Greetings from the Fans Arena team! We are thrilled to see you again.
        </p>
        <p style="font-size: 16px; color: #555;">
          ${message}
        </p>
        <p style="font-size: 16px; color: #555;">
          ${roleDescription}
        </p>
        <p style="font-size: 14px; color: #777; margin-top: 20px;">
          Regards,<br/>
          Fans Arena Team
        </p>
      </div>
    `,
    };
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const error = await response.json();
            console.error("Error sending email:", error);
            throw new Error(`Failed to send email: ${response.statusText}`);
        }
        const result = await response.json();
        console.log("Email sent successfully:", result);
    }
    catch (error) {
        console.error("Error occurred:", error);
    }
};
function generateRandomUid(length) {
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = c.length;
    let uid = '';
    for (let i = 0; i < length; i++) {
        uid += c.charAt(Math.floor(Math.random() * charactersLength));
    }
    return uid;
}
//send notification to club as a new fan
exports.sendnewfanNotifications = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https
    .onRequest(async (request, response) => {
    let username = '';
    let imageUrl = '';
    try {
        const queryParams = convertParsedQs(request.query);
        const currentUserUid = queryParams["uid1"];
        const otheruid = queryParams["uid2"];
        if (!currentUserUid || !otheruid) {
            response.status(400).json({ error: "User ID and other ID are required" });
            return;
        }
        // Fetch user data for the current user
        const currentUserSnapshot = await admin.firestore()
            .collection('Fans').doc(currentUserUid).get();
        if (!currentUserSnapshot.exists) {
            response.status(404).json({ error: "Current user not found" });
            return;
        }
        const currentUserData = currentUserSnapshot.data();
        if ((currentUserData === null || currentUserData === void 0 ? void 0 : currentUserData.profileimage) !== undefined) {
            imageUrl = currentUserData === null || currentUserData === void 0 ? void 0 : currentUserData.profileimage;
        }
        if ((currentUserData === null || currentUserData === void 0 ? void 0 : currentUserData.username) !== undefined) {
            username = currentUserData === null || currentUserData === void 0 ? void 0 : currentUserData.username;
        }
        // Send notification to the other user
        const otherUserSnapshot = await admin.firestore()
            .collection('Clubs').doc(otheruid).get();
        if (otherUserSnapshot.exists) {
            const otherUserData = otherUserSnapshot.data();
            const token = otherUserData === null || otherUserData === void 0 ? void 0 : otherUserData.fcmToken;
            if (token) {
                const message = {
                    notification: {
                        title: 'New fan',
                        body: `${username} is now your fan`,
                    },
                    data: {
                        click_action: "FLUTTER_NOTIFICATION_CLICK",
                        tab: "/Fan",
                    },
                    android: {
                        notification: {
                            sound: "default",
                            image: imageUrl,
                        },
                    },
                    token,
                };
                await sendANotification(message);
                await addANotification(otherUserSnapshot.ref, currentUserUid, otheruid, '', "is now your fan");
            }
        }
        response.status(200).json({ success: true, message: "successfully" });
    }
    catch (error) {
        console.error('Error sending notifications:', error);
        response.status(500).json({ error: "Internal server error" + error });
    }
});
//send notification to professional as a new fan
exports.sendnewfanPNotifications = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https
    .onRequest(async (request, response) => {
    let username = '';
    let imageUrl = '';
    try {
        const queryParams = convertParsedQs(request.query);
        const currentUserUid = queryParams["uid1"];
        const otheruid = queryParams["uid2"];
        if (!currentUserUid || !otheruid) {
            response.status(400).json({ error: "User ID and other ID are required" });
            return;
        }
        // Fetch user data for the current user
        const currentUserSnapshot = await admin.firestore()
            .collection('Fans').doc(currentUserUid).get();
        if (!currentUserSnapshot.exists) {
            response.status(404).json({ error: "Current user not found" });
            return;
        }
        const currentUserData = currentUserSnapshot.data();
        if ((currentUserData === null || currentUserData === void 0 ? void 0 : currentUserData.profileimage) !== undefined) {
            imageUrl = currentUserData === null || currentUserData === void 0 ? void 0 : currentUserData.profileimage;
        }
        if ((currentUserData === null || currentUserData === void 0 ? void 0 : currentUserData.username) !== undefined) {
            username = currentUserData === null || currentUserData === void 0 ? void 0 : currentUserData.username;
        }
        // Send notification to the other user
        const otherUserSnapshot = await admin.firestore()
            .collection('Professionals').doc(otheruid).get();
        if (otherUserSnapshot.exists) {
            const otherUserData = otherUserSnapshot.data();
            const token = otherUserData === null || otherUserData === void 0 ? void 0 : otherUserData.fcmToken;
            if (token) {
                const message = {
                    notification: {
                        title: 'New fan',
                        body: `${username} is now your fan`,
                    },
                    data: {
                        click_action: "FLUTTER_NOTIFICATION_CLICK",
                        tab: "/Fan",
                    },
                    android: {
                        notification: {
                            sound: "default",
                            image: imageUrl,
                        },
                    },
                    token,
                };
                await sendANotification(message);
                await addANotification(otherUserSnapshot.ref, currentUserUid, otheruid, '', "is now your fan");
            }
        }
        response.status(200).json({ success: true, message: "successfully" });
    }
    catch (error) {
        console.error('Error sending notifications:', error);
        response.status(500).json({ error: "Internal server error" + error });
    }
});
//send invite streaming notification
exports.sendinviteNotifications = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https
    .onRequest(async (request, response) => {
    let username = '';
    let imageUrl = '';
    try {
        const queryParams = convertParsedQs(request.query);
        const userIds1 = queryParams["uids"];
        const userId = queryParams['userId'];
        const event = queryParams['event'];
        const matchId = queryParams['matchId'];
        if (!userId || userIds1.length == 0 || !userId) {
            response.status(400).json({ error: "userId and userIds are required" });
            return;
        }
        const userIds = userIds1.split(',');
        const userData = await fetchUserData(userId);
        const useruids = Array.from(userIds);
        const registrationTokens = [];
        const usersData = [];
        // Fetch FCM tokens for all following users
        const promises = useruids.map(async (followerId) => {
            const userData = await fetchUserData(followerId);
            if (userData !== undefined) {
                registrationTokens.push(userData.token);
                usersData.push({
                    userId: userData.userId,
                    userRef: userData.docRef,
                });
            }
        });
        await Promise.all(promises);
        if (userData.profileImage !== undefined) {
            imageUrl = userData.profileImage;
        }
        if (userData.username !== undefined) {
            username = userData.username;
        }
        const topic = event + 'invite_notifications' + userId;
        const message = {
            notification: {
                title: 'Streaming Invitation',
                body: `${username} invited you to assist in filming their ${event}`,
            },
            topic: topic,
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                tab: "/Events",
                d: matchId
            },
            android: {
                notification: {
                    sound: "default",
                    image: imageUrl || "",
                },
            },
        };
        const uniquetokens = Array.from(new Set(registrationTokens)).filter(Boolean);
        await sendAllNotification(uniquetokens, message, topic);
        response.status(200).json({ success: true, message: "successfully" });
    }
    catch (error) {
        console.error('Error sending notifications:', error);
        response.status(500).json({ error: "Internal server error" + error });
    }
});
// sendleague notificatins
exports.sendleaguematchcreatedNotifications = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https
    .onRequest(async (request, response) => {
    try {
        if (request.method !== 'POST') {
            response.status(405).send('Method Not Allowed');
            return;
        }
        const data = request.body;
        const leagueId = data.leagueId;
        const matchId = data.matchId;
        const match1Id = data.match1Id;
        const club1 = data.club1;
        const club2 = data.club2;
        const leaguematchId = data.leaguematchId;
        // Send notification to author's followers
        const followingUids = new Set();
        //const allclubs: Set<string> = new Set([club1, club2]);
        let imageurl = '';
        //let name = '';
        // Helper function to collect UIDs
        const collectUids = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const followingData = doc.data()[key] || [];
                followingData.forEach((item) => {
                    if (item.userId) {
                        followingUids.add(item.userId);
                    }
                });
            });
        };
        const collectUids1 = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const clubsTeamTable = doc.data()[key] || [];
                const clubsteam = doc.data()['clubsteam'] || [];
                if (clubsTeamTable[1]) {
                    const fieldName = clubsTeamTable[1].fn;
                    clubsteam.forEach((clubItem) => {
                        if (clubItem[fieldName]) {
                            followingUids.add(clubItem[fieldName]);
                        }
                    });
                }
            });
        };
        // Collecting following UIDs
        const LeaguesSnapshot = await admin.firestore()
            .collection("Leagues").doc(leagueId).collection('year').get();
        LeaguesSnapshot.forEach(async (doc) => {
            const allclubsSnapshot = await admin.firestore()
                .collection("Leagues").doc(leagueId).collection('year')
                .doc(doc.id).collection('clubs').get();
            allclubsSnapshot.forEach((doc) => {
                const followingData = doc.data().clubs;
                followingData.forEach((club) => {
                    if (club.clubId != club1 || club.clubId != club2) {
                        followingUids.add(club.clubId);
                    }
                });
            });
        });
        const subsQuery = await admin.firestore()
            .collection("Leagues").doc(leagueId)
            .collection("subscribers").get();
        subsQuery.forEach((doc) => {
            const followingData = doc.data().subscribers;
            followingData.forEach((sub) => {
                followingUids.add(sub.userId);
            });
        });
        const getclubsF = async (club) => {
            const fromclubSnapshot = await admin.firestore().collection("Clubs").doc(club).collection("fans").get();
            collectUids(fromclubSnapshot, 'fans');
            const fromprofeSnapshot = await admin.firestore().collection("Professionals").doc(club).collection("fans").get();
            collectUids(fromprofeSnapshot, 'fans');
            const fromclubteamSnapshot = await admin.firestore().collection("Clubs").doc(club).collection("clubsteam").get();
            collectUids1(fromclubteamSnapshot, 'clubsTeamTable');
            const fromprofetSnapshot = await admin.firestore().collection("Professionals").doc(club).collection("trustedaccounts").get();
            collectUids(fromprofetSnapshot, 'accounts');
            const fromprofeclubSnapshot = await admin.firestore().collection("Professionals").doc(club).collection("club").get();
            fromprofeclubSnapshot.forEach((doc) => {
                if (doc.id) {
                    followingUids.add(doc.id);
                }
            });
        };
        // Fetch user data for current user
        const sendClubNotification = async (userData, matchId) => {
            if (userData !== undefined) {
                const token = userData.token;
                if (token !== undefined) {
                    const message = {
                        notification: {
                            title: 'New match',
                            body: `${userData3.username} has created a match for you `,
                        },
                        data: {
                            click_action: "FLUTTER_NOTIFICATION_CLICK",
                            tab: "/LMATCH",
                            d: matchId
                        },
                        android: {
                            notification: {
                                sound: "default",
                                image: userData3.profileImage,
                            },
                        },
                        token,
                    };
                    await sendANotification(message);
                    await addANotification(userData.docRef, leagueId, userData.userId, matchId, 'league has created a match for you');
                }
            }
        };
        const userData1 = await fetchUserData(club1);
        const userData2 = await fetchUserData(club2);
        const userData3 = await fetchUserData(leagueId);
        await getclubsF(club1);
        await getclubsF(club2);
        await sendClubNotification(userData1, matchId);
        await sendClubNotification(userData3, match1Id);
        const uniqueUids = Array.from(new Set(followingUids)).filter(Boolean);
        const useruids = Array.from(uniqueUids);
        const registrationTokens = [];
        const usersData = [];
        // Fetch FCM tokens for all following users
        const promises = useruids.map(async (followerId) => {
            const userData = await fetchUserData(followerId);
            if (userData !== undefined) {
                registrationTokens.push(userData.token);
                usersData.push({
                    userId: userData.userId,
                    userRef: userData.docRef,
                });
            }
        });
        await Promise.all(promises);
        if (userData3.profileImage !== undefined) {
            imageurl = userData3.profileImage;
            //name = userData1?.Clubname;
        }
        // Subscribe the devices to the topic
        const topic = 'leaguematch_notifications' + leagueId;
        const message = {
            notification: {
                title: 'New match',
                body: `${userData3.username} has created a match, ${userData1.username} vs ${userData2.username} `,
            },
            topic: topic,
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                tab: "/LMatch",
                d: matchId
            },
            android: {
                notification: {
                    sound: "default",
                    image: imageurl,
                },
            },
        };
        const uniquetokens = Array.from(new Set(registrationTokens)).filter(Boolean);
        await sendAllNotification(uniquetokens, message, topic);
        await addAllNotifications(usersData, leagueId, leaguematchId, 'league has created a match');
    }
    catch (error) {
        console.error('Error sending notifications:', error);
        response.status(500).json({ error: "Internal server error" + error });
    }
});
//liking a post online mode... use queue
//commenting a post oneline mode... use queue
//commenting a post offline mode
//liking a post offline mode
//chatting online mode... use queue
//chatiing offline mode
//posts you have interacted with
exports.getpostsinteractedwith = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (request, response) => {
    try {
        const queryParams = request.query;
        const currentUserUid = queryParams["uid"];
        if (!currentUserUid) {
            response.status(400).json({ error: "User ID is required" });
            return;
        }
        const matchIds = new Set();
        const allLeaguesSnapshot = await admin.firestore().collection("posts").get();
        for (const leagueDoc of allLeaguesSnapshot.docs) {
            const matchId = leagueDoc.id;
            const allCommentsSnapshot = await admin.firestore()
                .collection("posts").doc(matchId)
                .collection("comments").get();
            if (!allCommentsSnapshot.empty) {
                allCommentsSnapshot.docs.forEach((doc) => {
                    const followingData = doc.data().comments || [];
                    followingData.forEach((comment) => {
                        if (currentUserUid === comment.userId) {
                            matchIds.add(matchId);
                        }
                    });
                });
            }
            const allLikesSnapshot = await admin.firestore()
                .collection("posts").doc(matchId)
                .collection("likes").get();
            if (!allLikesSnapshot.empty) {
                allLikesSnapshot.docs.forEach((doc) => {
                    const followingData = doc.data().likes || [];
                    followingData.forEach((like) => {
                        if (currentUserUid === like.userId) {
                            matchIds.add(matchId);
                        }
                    });
                });
            }
            const allRepliesSnapshot = await admin.firestore()
                .collection("posts").doc(matchId)
                .collection("replies").get();
            if (!allRepliesSnapshot.empty) {
                allRepliesSnapshot.docs.forEach((doc) => {
                    const followingData = doc.data().replies || [];
                    followingData.forEach((reply) => {
                        if (currentUserUid === reply.userId) {
                            matchIds.add(matchId);
                        }
                    });
                });
            }
        }
        const matchIdsArray = Array.from(matchIds);
        const chunkSize = 30;
        const matchChunks = [];
        for (let i = 0; i < matchIdsArray.length; i += chunkSize) {
            matchChunks.push(matchIdsArray.slice(i, i + chunkSize));
        }
        const postsPromises = matchChunks.map(async (chunk) => {
            const postsQuery = await admin.firestore().collection("posts")
                .where("postId", "in", chunk)
                .orderBy("createdAt", "desc")
                .limit(10)
                .get();
            return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
        });
        const postsArrays = await Promise.all(postsPromises);
        const posts1 = postsArrays.flat();
        const posts = await Promise.all(posts1.map(async (post) => {
            const userData = await fetchUserData(post.authorId);
            const captionUrl = await getImageAspectRatios(post.captionUrl);
            return Object.assign(Object.assign({}, post), { author: userData, captionUrl: captionUrl });
        }));
        response.json({ posts });
    }
    catch (error) {
        console.error("Error getting posts:", error);
        response.status(500).json({ error: "Failed to get posts" + error });
    }
});
//fanstv you have interacted with
exports.getFansTvinteractedwith = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (request, response) => {
    try {
        const queryParams = request.query;
        const currentUserUid = queryParams["uid"];
        if (!currentUserUid) {
            response.status(400).json({ error: "User ID is required" });
            return;
        }
        const matchIds = new Set();
        const allLeaguesSnapshot = await admin.firestore().collection("FansTv").get();
        for (const leagueDoc of allLeaguesSnapshot.docs) {
            const matchId = leagueDoc.id;
            const allCommentsSnapshot = await admin.firestore()
                .collection("FansTv").doc(matchId)
                .collection("comments").get();
            if (!allCommentsSnapshot.empty) {
                allCommentsSnapshot.docs.forEach((doc) => {
                    const followingData = doc.data().comments || [];
                    followingData.forEach((comment) => {
                        if (currentUserUid === comment.userId) {
                            matchIds.add(matchId);
                        }
                    });
                });
            }
            const allLikesSnapshot = await admin.firestore()
                .collection("FansTv").doc(matchId)
                .collection("likes").get();
            if (!allLikesSnapshot.empty) {
                allLikesSnapshot.docs.forEach((doc) => {
                    const followingData = doc.data().likes || [];
                    followingData.forEach((like) => {
                        if (currentUserUid === like.userId) {
                            matchIds.add(matchId);
                        }
                    });
                });
            }
            const allViewsSnapshot = await admin.firestore()
                .collection("FansTv").doc(matchId)
                .collection("views").get();
            if (!allViewsSnapshot.empty) {
                allViewsSnapshot.docs.forEach((doc) => {
                    const followingData = doc.data().views || [];
                    followingData.forEach((view) => {
                        if (currentUserUid === view.userId) {
                            matchIds.add(matchId);
                        }
                    });
                });
            }
            const allRepliesSnapshot = await admin.firestore()
                .collection("FansTv").doc(matchId)
                .collection("replies").get();
            if (!allRepliesSnapshot.empty) {
                allRepliesSnapshot.docs.forEach((doc) => {
                    const followingData = doc.data().replies || [];
                    followingData.forEach((reply) => {
                        if (currentUserUid === reply.userId) {
                            matchIds.add(matchId);
                        }
                    });
                });
            }
        }
        const matchIdsArray = Array.from(matchIds);
        const chunkSize = 30;
        const matchChunks = [];
        for (let i = 0; i < matchIdsArray.length; i += chunkSize) {
            matchChunks.push(matchIdsArray.slice(i, i + chunkSize));
        }
        const postsPromises = matchChunks.map(async (chunk) => {
            const postsQuery = await admin.firestore().collection("FansTv")
                .where("postId", "in", chunk)
                .orderBy("createdAt", "desc")
                .limit(10)
                .get();
            return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
        });
        const postsArrays = await Promise.all(postsPromises);
        const posts1 = postsArrays.flat();
        const posts = await Promise.all(posts1.map(async (post) => {
            const userData = await fetchUserData(post.authorId);
            return Object.assign(Object.assign({}, post), { author: userData });
        }));
        response.json({ posts });
    }
    catch (error) {
        console.error("Error getting posts:", error);
        response.status(500).json({ error: "Failed to get posts" + error });
    }
});
//shared their lineup
exports.sendmatchlineupNotifications = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https
    .onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const currentUserUid = queryParams["uid"];
        const matchId = queryParams["matchId"];
        if (!currentUserUid || !matchId) {
            response.status(400).json({ error: "uid and matchId are required" });
            return;
        }
        // Send notification to author's followers
        const followingUids = new Set();
        //  let imageurl:string='';
        //let name:string='';
        // Helper function to collect UIDs
        const collectUids = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const followingData = doc.data()[key] || [];
                followingData.forEach((item) => {
                    if (item.userId) {
                        followingUids.add(item.userId);
                    }
                });
            });
        };
        const collectUids1 = (snapshot, key) => {
            snapshot.forEach((doc) => {
                const clubsTeamTable = doc.data()[key] || [];
                const clubsteam = doc.data()['clubsteam'] || [];
                if (clubsTeamTable[1]) {
                    const fieldName = clubsTeamTable[1].fn;
                    clubsteam.forEach((clubItem) => {
                        if (clubItem[fieldName]) {
                            followingUids.add(clubItem[fieldName]);
                        }
                    });
                }
            });
        };
        // Collecting following UIDs
        const followingSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("following").get();
        collectUids(followingSnapshot, 'following');
        const clubSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("clubs").get();
        collectUids(clubSnapshot, 'clubs');
        const profesSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("professionals").get();
        collectUids(profesSnapshot, 'professionals');
        const fromclubSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("fans").get();
        collectUids(fromclubSnapshot, 'fans');
        const fromprofeSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("fans").get();
        collectUids(fromprofeSnapshot, 'fans');
        const fromclubteamSnapshot = await admin.firestore().collection("Clubs").doc(currentUserUid).collection("clubsteam").get();
        collectUids1(fromclubteamSnapshot, 'clubsTeamTable');
        const fromprofetSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("trustedaccounts").get();
        collectUids(fromprofetSnapshot, 'accounts');
        const fromprofeclubSnapshot = await admin.firestore().collection("Professionals").doc(currentUserUid).collection("club").get();
        fromprofeclubSnapshot.forEach((doc) => {
            if (doc.id) {
                followingUids.add(doc.id);
            }
        });
        // Fetch user data for current user
        const useruids = Array.from(followingUids).filter(uid => uid !== currentUserUid);
        const registrationTokens = [];
        const usersData = [];
        // Fetch FCM tokens for all following users
        const promises = useruids.map(async (followerId) => {
            const userData = await fetchUserData(followerId);
            if (userData !== undefined) {
                registrationTokens.push(userData.token);
                usersData.push({
                    userId: userData.userId,
                    userRef: userData.docRef,
                });
            }
        });
        await Promise.all(promises);
        const userData3 = await fetchUserData(currentUserUid);
        const token = userData3.token;
        if (token) {
            const message = {
                notification: {
                    title: 'New Line Up',
                    body: `You have succeded in uploading Line Up`,
                },
                data: {
                    click_action: "FLUTTER_NOTIFICATION_CLICK",
                    tab: "/Matches",
                    d: matchId
                },
                android: {
                    notification: {
                        sound: "default",
                        image: "",
                    },
                },
                token,
            };
            await sendANotification(message);
        }
        // Subscribe the devices to the topic
        const topic = 'match_notifications' + currentUserUid;
        const message = {
            notification: {
                title: 'Match Lineup',
                body: `${userData3.username} has shared their lineup `,
            },
            topic: topic,
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                tab: "/Matches",
                d: matchId
            },
            android: {
                notification: {
                    sound: "default",
                    image: '',
                },
            },
        };
        const uniquetokens = Array.from(new Set(registrationTokens)).filter(Boolean);
        await sendAllNotification(uniquetokens, message, topic);
        await addAllNotifications(usersData, currentUserUid, matchId, "shared their line_up");
    }
    catch (error) {
        console.error('Error sending notifications:', error);
        response.status(500).json({ error: "Internal server error" + error });
    }
});
//shared their lineup
exports.sendcommentNotifications = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https
    .onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const from = queryParams["from"];
        const to = queryParams["to"];
        const comment = queryParams["comment"];
        const commentId = queryParams["commentId"];
        const postId = queryParams["postId"];
        const event = queryParams["event"];
        let username = '';
        if (!comment || !commentId || !to || !from) {
            response.status(400).json({
                error: "from, to,comment and commentId are required"
            });
            return;
        }
        const userData = await fetchUserData(from);
        if (userData.username !== undefined) {
            username = userData.username;
        }
        const userData1 = await fetchUserData(to);
        const token = userData1.token;
        const message = {
            notification: {
                title: 'New Comment',
                body: `${username} has commented on your ${event} `,
            },
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                tab: "/Comment",
                d: commentId,
            },
            android: {
                notification: {
                    sound: "default",
                    image: '',
                },
            },
            token
        };
        await addANotification(userData1.docRef, from, to, postId, `has commented on your ${event}`);
        await sendANotification(message);
        // Send notification to author's followers
        response.json({});
    }
    catch (error) {
        console.error('Error sending notifications:', error);
        response.status(500).json({ error: "Internal server error" });
    }
});
exports.sendreplyNotifications = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https
    .onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const from = queryParams["from"];
        const to = queryParams["to"];
        const comment = queryParams["reply"];
        const commentId = queryParams["replyId"];
        const postId = queryParams["postId"];
        const event = queryParams["event"];
        let username = '';
        if (!comment || !commentId || !to || !from) {
            response.status(400).json({
                error: "from, to,comment and commentId are required"
            });
            return;
        }
        const userData = await fetchUserData(from);
        if (userData.username !== undefined) {
            username = userData.username;
        }
        const userData1 = await fetchUserData(to);
        const token = userData1.token;
        const message = {
            notification: {
                title: 'New Comment',
                body: `${username} has replied to your comment on a, ${event}`,
            },
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                tab: "/Comment",
                d: commentId,
            },
            android: {
                notification: {
                    sound: "default",
                    image: '',
                },
            },
            token
        };
        await addANotification(userData1.docRef, from, to, postId, `replied to your comment on this, ${event}`);
        await sendANotification(message);
        // Send notification to author's followers
        response.json({});
    }
    catch (error) {
        console.error('Error sending notifications:', error);
        response.status(500).json({ error: "Internal server error" });
    }
});
exports.sendlikedNotifications = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https
    .onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const from = queryParams["from"];
        const to = queryParams["to"];
        const postId = queryParams["postId"];
        const event = queryParams["event"];
        let username = '';
        if (!to || !from) {
            response.status(400).json({
                error: "from, to,comment and commentId are required"
            });
            return;
        }
        const userData = await fetchUserData(from);
        if (userData.username !== undefined) {
            username = userData.username;
        }
        const userData1 = await fetchUserData(to);
        const token = userData1.token;
        const message = {
            notification: {
                title: 'New like',
                body: `${username} liked your ${event}`,
            },
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                tab: "/post",
                d: postId,
            },
            android: {
                notification: {
                    sound: "default",
                    image: '',
                },
            },
            token
        };
        await sendANotification(message);
        // Send notification to author's followers
        response.json({});
    }
    catch (error) {
        console.error('Error sending notifications:', error);
        response.status(500).json({ error: "Internal server error" });
    }
});
function checkAndRespond(input) {
    const responses = [
        { phrase: "league team", response: "added you to the league team" },
        { phrase: "Club's team", response: "added you to the Club's team" },
        { phrase: "league top scorers table", response: "added you to the league top scorers table" }
    ];
    for (const { phrase, response } of responses) {
        if (input.toLowerCase().includes(phrase.toLowerCase())) {
            return response;
        }
    }
    return "";
}
exports.sendInvitationNotification = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const from = queryParams["from"];
        const to = queryParams["to"];
        const m = queryParams["message"];
        if (!to || !from) {
            response.status(400).json({
                error: "from, to,comment and commentId are required"
            });
            return;
        }
        const userData = await fetchUserData(to);
        const token = userData.token;
        const message = {
            notification: {
                title: 'Ivitation',
                body: m,
            },
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                tab: "/Inivite",
                d: '',
            },
            android: {
                notification: {
                    sound: "default",
                    image: '',
                },
            },
            token
        };
        await sendANotification(message);
        const result = checkAndRespond(m);
        await addANotification(userData.docRef, from, to, "", result);
        // Send notification to author's followers
        response.json({});
    }
    catch (error) {
        console.error('Error sending notifications:', error);
        response.status(500).json({ error: "Internal server error" });
    }
});
//matches you have watched
exports.getmatcheswatched = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (request, response) => {
    try {
        const queryParams = request.query;
        const currentUserUid = queryParams["uid"];
        if (!currentUserUid) {
            response.status(400).json({ error: "User ID is required" });
            return;
        }
        const matchIds = new Set();
        const allLeaguesSnapshot = await admin.firestore().collection("Matches").get();
        for (const leagueDoc of allLeaguesSnapshot.docs) {
            const matchId = leagueDoc.id;
            const allcommentsSnapshot = await admin.firestore()
                .collection("Matches").doc(matchId)
                .collection("comments").get();
            if (!allcommentsSnapshot.empty) {
                allcommentsSnapshot.docs.forEach((doc) => {
                    const followingData = doc.data().comments || [];
                    followingData.forEach((comment) => {
                        if (currentUserUid === comment.userId) {
                            matchIds.add(matchId);
                        }
                    });
                });
            }
            const allLikesSnapshot = await admin.firestore()
                .collection("Matches").doc(matchId)
                .collection("likes").get();
            if (!allLikesSnapshot.empty) {
                allLikesSnapshot.docs.forEach((doc) => {
                    const followingData = doc.data().likes || [];
                    followingData.forEach((like) => {
                        if (currentUserUid === like.userId) {
                            matchIds.add(matchId);
                        }
                    });
                });
            }
            const allviewsSnapshot = await admin.firestore()
                .collection("Matches").doc(matchId)
                .collection("views").get();
            if (!allviewsSnapshot.empty) {
                allviewsSnapshot.docs.forEach((doc) => {
                    const followingData = doc.data().views || [];
                    followingData.forEach((view) => {
                        if (currentUserUid === view.userId) {
                            matchIds.add(matchId);
                        }
                    });
                });
            }
        }
        const matchIdsArray = Array.from(matchIds);
        const chunkSize = 30;
        const matchChunks = [];
        for (let i = 0; i < matchIdsArray.length; i += chunkSize) {
            matchChunks.push(matchIdsArray.slice(i, i + chunkSize));
        }
        const matchesPromises = matchChunks.map(async (chunk) => {
            const postsQuery = await admin.firestore().collection("Matches")
                .where("matchId", "in", chunk)
                .orderBy("createdAt", "desc")
                .limit(10)
                .get();
            return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
        });
        const matchesArrays = await Promise.all(matchesPromises);
        const matches1 = matchesArrays.flat();
        const matches = await Promise.all(matches1.map(async (post) => {
            const userData1 = await fetchUserData(post.club1Id);
            const userData2 = await fetchUserData(post.club2Id);
            const userData3 = await fetchUserData(post.leagueId);
            return Object.assign(Object.assign({}, post), { club1: userData1, club2: userData2, league: userData3 });
        }));
        response.json({ matches });
    }
    catch (error) {
        console.error("Error getting posts:", error);
        response.status(500).json({ error: "Failed to get posts" });
    }
});
//events you have watched
exports.geteventswatched = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (request, response) => {
    try {
        const queryParams = request.query;
        const currentUserUid = queryParams["uid"];
        if (!currentUserUid) {
            response.status(400).json({ error: "User ID is required" });
            return;
        }
        const eventIds = new Set();
        const allLeaguesSnapshot = await admin.firestore().collection("Events").get();
        for (const leagueDoc of allLeaguesSnapshot.docs) {
            const eventId = leagueDoc.id;
            const allCommentsSnapshot = await admin.firestore()
                .collection("Events").doc(eventId)
                .collection("comments").get();
            if (!allCommentsSnapshot.empty) {
                allCommentsSnapshot.docs.forEach((doc) => {
                    const followingData = doc.data().comments || [];
                    followingData.forEach((comment) => {
                        if (currentUserUid === comment.userId) {
                            eventIds.add(eventId);
                        }
                    });
                });
            }
            const allLikesSnapshot = await admin.firestore()
                .collection("Events").doc(eventId)
                .collection("likes").get();
            if (!allLikesSnapshot.empty) {
                allLikesSnapshot.docs.forEach((doc) => {
                    const followingData = doc.data().likes || [];
                    followingData.forEach((like) => {
                        if (currentUserUid === like.userId) {
                            eventIds.add(eventId);
                        }
                    });
                });
            }
            const allViewsSnapshot = await admin.firestore()
                .collection("Events").doc(eventId)
                .collection("views").get();
            if (!allViewsSnapshot.empty) {
                allViewsSnapshot.docs.forEach((doc) => {
                    const followingData = doc.data().views || [];
                    followingData.forEach((view) => {
                        if (currentUserUid === view.userId) {
                            eventIds.add(eventId);
                        }
                    });
                });
            }
        }
        const eventIdsArray = Array.from(eventIds);
        const chunkSize = 30;
        const eventChunks = [];
        for (let i = 0; i < eventIdsArray.length; i += chunkSize) {
            eventChunks.push(eventIdsArray.slice(i, i + chunkSize));
        }
        const eventsPromises = eventChunks.map(async (chunk) => {
            const postsQuery = await admin.firestore().collection("Events")
                .where("eventId", "in", chunk)
                .orderBy("createdAt", "desc")
                .limit(10)
                .get();
            return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
        });
        const eventsArrays = await Promise.all(eventsPromises);
        const events1 = eventsArrays.flat();
        const events = await Promise.all(events1.map(async (post) => {
            const userData1 = await fetchUserData(post.authorId);
            return Object.assign(Object.assign({}, post), { author: userData1 });
        }));
        response.json({ events });
    }
    catch (error) {
        console.error("Error getting events:", error);
        response.status(500).json({ error: "Failed to get events" });
    }
});
//Todays matches
exports.getTodaysmatches =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const currentUserUid = queryParams["uid"];
            const date = queryParams["date"];
            if (!currentUserUid || !date) {
                response.status(400).json({ error: "uid and date are required" });
                return;
            }
            const followingUids = [currentUserUid];
            const clubSnapshot = await admin.firestore()
                .collection("Fans").doc(currentUserUid).collection("clubs").get();
            clubSnapshot.forEach((doc) => {
                const followingData = doc.data().clubs;
                followingData.forEach((clubs) => {
                    followingUids.push(clubs.userId);
                });
            });
            const profesSnapshot = await admin.firestore()
                .collection("Fans").doc(currentUserUid).collection("professionals").get();
            profesSnapshot.forEach((doc) => {
                const followingData = doc.data().professionals;
                followingData.forEach((professionals) => {
                    followingUids.push(professionals.userId);
                });
            });
            const t = new Date(date);
            const d1 = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
            const d2 = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
            d1.setHours(0, 0, 0, 0);
            d2.setHours(23, 59, 59, 999);
            //const today= admin.firestore.Timestamp.fromDate(t); 
            const uniqueUids = Array.from(new Set(followingUids)).filter(Boolean);
            const chunkArray = (array, size) => {
                const result = [];
                for (let i = 0; i < array.length; i += size) {
                    result.push(array.slice(i, i + size));
                }
                return result;
            };
            const uidChunks = chunkArray(uniqueUids, 30);
            const postsPromises = uidChunks.map(async (uids) => {
                const postsQuery = await admin.firestore().collection("Matches")
                    .where("authorId", "in", uids)
                    .where('scheduledDate', '>=', d1)
                    .where('scheduledDate', "<=", d2)
                    .orderBy("createdAt", "desc")
                    .get();
                return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            });
            const postsArray = await Promise.all(postsPromises);
            const posts = [].concat(...postsArray);
            const matches = await Promise.all(posts.map(async (post) => {
                const userData1 = await fetchUserData(post.club1Id);
                const userData2 = await fetchUserData(post.club2Id);
                const userData3 = await fetchUserData(post.leagueId);
                // Merge user data into the post object
                return Object.assign(Object.assign({}, post), { club1: userData1, club2: userData2, league: userData3 });
            }));
            response.json({ matches });
        }
        catch (error) {
            console.error("Error getting matches:", error);
            response.status(500).json({ error: "Failed to get matches" + error });
        }
    });
//todays events
exports.getTodaysevents =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const currentUserUid = queryParams["uid"];
            const date = queryParams["date"];
            if (!currentUserUid || !date) {
                response.status(400).json({ error: "uid and date are required" });
                return;
            }
            const followingUids = [currentUserUid];
            const clubSnapshot = await admin.firestore()
                .collection("Fans").doc(currentUserUid).collection("clubs").get();
            clubSnapshot.forEach((doc) => {
                const followingData = doc.data().clubs;
                followingData.forEach((clubs) => {
                    followingUids.push(clubs.userId);
                });
            });
            const profesSnapshot = await admin.firestore()
                .collection("Fans").doc(currentUserUid).collection("professionals").get();
            profesSnapshot.forEach((doc) => {
                const followingData = doc.data().professionals;
                followingData.forEach((professionals) => {
                    followingUids.push(professionals.userId);
                });
            });
            const t = new Date(date);
            const d1 = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
            const d2 = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
            d1.setHours(0, 0, 0, 0);
            d2.setHours(23, 59, 59, 999);
            //const today= admin.firestore.Timestamp.fromDate(t); 
            const uniqueUids = Array.from(new Set(followingUids)).filter(Boolean);
            const chunkArray = (array, size) => {
                const result = [];
                for (let i = 0; i < array.length; i += size) {
                    result.push(array.slice(i, i + size));
                }
                return result;
            };
            const uidChunks = chunkArray(uniqueUids, 30);
            const postsPromises = uidChunks.map(async (uids) => {
                const postsQuery = await admin.firestore().collection("Events")
                    .where("authorId", "in", uids)
                    .where('scheduledDate', '>=', d1)
                    .where('scheduledDate', "<=", d2)
                    .orderBy("createdAt", "desc")
                    .get();
                return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            });
            const postsArray = await Promise.all(postsPromises);
            const posts = [].concat(...postsArray);
            const events = await Promise.all(posts.map(async (post) => {
                const userData1 = await fetchUserData(post.authorId);
                // Merge user data into the post object
                return Object.assign(Object.assign({}, post), { author: userData1 });
            }));
            response.json({ events });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
//This week matches
exports.getweeksmatches =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const currentUserUid = queryParams["uid"];
            const date = queryParams["date"];
            if (!date) {
                response.status(400).json({ error: "uid and date are required" });
                return;
            }
            const followingUids = [currentUserUid];
            const t = new Date(date);
            // Calculate start of the week (Sunday)
            const startOfWeek = new Date(t);
            startOfWeek.setDate(t.getDate() - t.getDay() - 1);
            startOfWeek.setHours(0, 0, 0, 0);
            // Calculate end of the week (Saturday)
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            //const today= admin.firestore.Timestamp.fromDate(t); 
            const uniqueUids = Array.from(new Set(followingUids)).filter(Boolean);
            const chunkArray = (array, size) => {
                const result = [];
                for (let i = 0; i < array.length; i += size) {
                    result.push(array.slice(i, i + size));
                }
                return result;
            };
            const uidChunks = chunkArray(uniqueUids, 30);
            const postsPromises = uidChunks.map(async (uids) => {
                const postsQuery = await admin.firestore().collection("Matches")
                    .where("authorId", "in", uids)
                    .where('scheduledDate', '>=', startOfWeek)
                    .where('scheduledDate', "<=", endOfWeek)
                    .orderBy("createdAt", "desc")
                    .get();
                return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            });
            const postsArray = await Promise.all(postsPromises);
            const posts = [].concat(...postsArray);
            const matches = await Promise.all(posts.map(async (post) => {
                const userData1 = await fetchUserData(post.club1Id);
                const userData2 = await fetchUserData(post.club2Id);
                const userData3 = await fetchUserData(post.leagueId);
                // Merge user data into the post object
                return Object.assign(Object.assign({}, post), { club1: userData1, club2: userData2, league: userData3 });
            }));
            response.json({ matches });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
exports.getweeksmatches1 =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const currentUserUid = queryParams["uid"];
            const date = queryParams["date"];
            if (!date) {
                response.status(400).json({ error: "uid and date are required" });
                return;
            }
            const followingUids = [];
            const clubSnapshot = await admin.firestore()
                .collection("Professionals").doc(currentUserUid).collection("club").get();
            clubSnapshot.forEach((doc) => {
                followingUids.push(doc.id);
            });
            const t = new Date(date);
            // Calculate start of the week (Sunday)
            const startOfWeek = new Date(t);
            startOfWeek.setDate(t.getDate() - t.getDay() - 1);
            startOfWeek.setHours(0, 0, 0, 0);
            // Calculate end of the week (Saturday)
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            //const today= admin.firestore.Timestamp.fromDate(t); 
            const uniqueUids = Array.from(new Set(followingUids)).filter(Boolean);
            const chunkArray = (array, size) => {
                const result = [];
                for (let i = 0; i < array.length; i += size) {
                    result.push(array.slice(i, i + size));
                }
                return result;
            };
            const uidChunks = chunkArray(uniqueUids, 30);
            const postsPromises = uidChunks.map(async (uids) => {
                const postsQuery = await admin.firestore().collection("Matches")
                    .where("authorId", "in", uids)
                    .where('scheduledDate', '>=', startOfWeek)
                    .where('scheduledDate', "<=", endOfWeek)
                    .orderBy("createdAt", "desc")
                    .get();
                return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            });
            const postsArray = await Promise.all(postsPromises);
            const posts = [].concat(...postsArray);
            const matches = await Promise.all(posts.map(async (post) => {
                const userData1 = await fetchUserData(post.club1Id);
                const userData2 = await fetchUserData(post.club2Id);
                const userData3 = await fetchUserData(post.leagueId);
                // Merge user data into the post object
                return Object.assign(Object.assign({}, post), { club1: userData1, club2: userData2, league: userData3 });
            }));
            response.json({ matches });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
//weeks events
exports.getweeksevents =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const currentUserUid = queryParams["uid"];
            const date = queryParams["date"];
            if (!date) {
                response.status(400).json({ error: "date are required" });
                return;
            }
            const followingUids = [currentUserUid];
            const t = new Date(date);
            // Calculate start of the week (Sunday)
            const startOfWeek = new Date(t);
            startOfWeek.setDate(t.getDate() - t.getDay() - 1);
            startOfWeek.setHours(0, 0, 0, 0);
            // Calculate end of the week (Saturday)
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            //const today= admin.firestore.Timestamp.fromDate(t); 
            const uniqueUids = Array.from(new Set(followingUids)).filter(Boolean);
            const chunkArray = (array, size) => {
                const result = [];
                for (let i = 0; i < array.length; i += size) {
                    result.push(array.slice(i, i + size));
                }
                return result;
            };
            const uidChunks = chunkArray(uniqueUids, 30);
            const postsPromises = uidChunks.map(async (uids) => {
                const postsQuery = await admin.firestore().collection("Events")
                    .where("authorId", "in", uids)
                    .where('scheduledDate', '>=', startOfWeek)
                    .where('scheduledDate', "<=", endOfWeek)
                    .orderBy("createdAt", "desc")
                    .get();
                return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            });
            const postsArray = await Promise.all(postsPromises);
            const posts = [].concat(...postsArray);
            const events = await Promise.all(posts.map(async (post) => {
                const userData1 = await fetchUserData(post.authorId);
                // Merge user data into the post object
                return Object.assign(Object.assign({}, post), { author: userData1 });
            }));
            response.json({ events });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
exports.getweeksevents1 =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const currentUserUid = queryParams["uid"];
            const date = queryParams["date"];
            if (!date) {
                response.status(400).json({ error: "date are required" });
                return;
            }
            const followingUids = [];
            const clubSnapshot = await admin.firestore()
                .collection("Professionals").doc(currentUserUid).collection("club").get();
            clubSnapshot.forEach((doc) => {
                followingUids.push(doc.id);
            });
            const t = new Date(date);
            // Calculate start of the week (Sunday)
            const startOfWeek = new Date(t);
            startOfWeek.setDate(t.getDate() - t.getDay() - 1);
            startOfWeek.setHours(0, 0, 0, 0);
            // Calculate end of the week (Saturday)
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            //const today= admin.firestore.Timestamp.fromDate(t);     
            const uniqueUids = Array.from(new Set(followingUids)).filter(Boolean);
            const chunkArray = (array, size) => {
                const result = [];
                for (let i = 0; i < array.length; i += size) {
                    result.push(array.slice(i, i + size));
                }
                return result;
            };
            const uidChunks = chunkArray(uniqueUids, 30);
            const postsPromises = uidChunks.map(async (uids) => {
                const postsQuery = await admin.firestore().collection("Events")
                    .where("authorId", "in", uids)
                    .where('scheduledDate', '>=', startOfWeek)
                    .where('scheduledDate', "<=", endOfWeek)
                    .orderBy("createdAt", "desc")
                    .get();
                return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            });
            const postsArray = await Promise.all(postsPromises);
            const posts = [].concat(...postsArray);
            const events = await Promise.all(posts.map(async (post) => {
                const userData1 = await fetchUserData(post.authorId);
                // Merge user data into the post object
                return Object.assign(Object.assign({}, post), { author: userData1 });
            }));
            response.json({ events });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
//Upcoming matches
exports.getUpcomingmatches =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const currentUserUid = queryParams["uid"];
            const date = queryParams["date"];
            if (!currentUserUid || !date) {
                response.status(400).json({ error: "uid and date are required" });
                return;
            }
            const followingUids = [currentUserUid];
            const clubSnapshot = await admin.firestore()
                .collection("Fans").doc(currentUserUid).collection("clubs").get();
            clubSnapshot.forEach((doc) => {
                const followingData = doc.data().clubs;
                followingData.forEach((clubs) => {
                    followingUids.push(clubs.userId);
                });
            });
            const profesSnapshot = await admin.firestore()
                .collection("Fans").doc(currentUserUid).collection("professionals").get();
            profesSnapshot.forEach((doc) => {
                const followingData = doc.data().professionals;
                followingData.forEach((professionals) => {
                    followingUids.push(professionals.userId);
                });
            });
            const today = new Date(date);
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay() - 1);
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            const uniqueUids = Array.from(new Set(followingUids)).filter(Boolean);
            const chunkArray = (array, size) => {
                const result = [];
                for (let i = 0; i < array.length; i += size) {
                    result.push(array.slice(i, i + size));
                }
                return result;
            };
            const uidChunks = chunkArray(uniqueUids, 30);
            const postsPromises = uidChunks.map(async (uids) => {
                const postsQuery = await admin.firestore().collection("Matches")
                    .where("authorId", "in", uids)
                    .where('scheduledDate', ">", today)
                    .where('scheduledDate', "<=", endOfWeek)
                    .orderBy("createdAt", "desc")
                    .get();
                return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            });
            const postsArray = await Promise.all(postsPromises);
            const posts = [].concat(...postsArray);
            const matches = await Promise.all(posts.map(async (post) => {
                const userData1 = await fetchUserData(post.club1Id);
                const userData2 = await fetchUserData(post.club2Id);
                const userData3 = await fetchUserData(post.leagueId);
                // Merge user data into the post object
                return Object.assign(Object.assign({}, post), { club1: userData1, club2: userData2, league: userData3 });
            }));
            response.json({ matches });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
//upcoming events
exports.getUpcomingevents =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const currentUserUid = queryParams["uid"];
            const date = queryParams["date"];
            if (!currentUserUid || !date) {
                response.status(400).json({ error: "uid and date are required" });
                return;
            }
            const followingUids = [currentUserUid];
            const clubSnapshot = await admin.firestore()
                .collection("Fans").doc(currentUserUid).collection("clubs").get();
            clubSnapshot.forEach((doc) => {
                const followingData = doc.data().clubs;
                followingData.forEach((clubs) => {
                    followingUids.push(clubs.userId);
                });
            });
            const profesSnapshot = await admin.firestore()
                .collection("Fans").doc(currentUserUid).collection("professionals").get();
            profesSnapshot.forEach((doc) => {
                const followingData = doc.data().professionals;
                followingData.forEach((professionals) => {
                    followingUids.push(professionals.userId);
                });
            });
            const today = new Date(date);
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay() - 1);
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            const uniqueUids = Array.from(new Set(followingUids)).filter(Boolean);
            const chunkArray = (array, size) => {
                const result = [];
                for (let i = 0; i < array.length; i += size) {
                    result.push(array.slice(i, i + size));
                }
                return result;
            };
            const uidChunks = chunkArray(uniqueUids, 30);
            const postsPromises = uidChunks.map(async (uids) => {
                const postsQuery = await admin.firestore().collection("Events")
                    .where("authorId", "in", uids)
                    .where('scheduledDate', ">", today)
                    .where('scheduledDate', "<=", endOfWeek)
                    .orderBy("createdAt", "desc")
                    .get();
                return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            });
            const postsArray = await Promise.all(postsPromises);
            const posts = [].concat(...postsArray);
            const events = await Promise.all(posts.map(async (post) => {
                const userData1 = await fetchUserData(post.authorId);
                // Merge user data into the post object
                return Object.assign(Object.assign({}, post), { author: userData1 });
            }));
            response.json({ events });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
//Past matches
exports.getPastmatches =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const currentUserUid = queryParams["uid"];
            const date = queryParams["date"];
            if (!currentUserUid || !date) {
                response.status(400).json({ error: "uid and date are required" });
                return;
            }
            const followingUids = [currentUserUid];
            const clubSnapshot = await admin.firestore()
                .collection("Fans").doc(currentUserUid).collection("clubs").get();
            clubSnapshot.forEach((doc) => {
                const followingData = doc.data().clubs;
                followingData.forEach((clubs) => {
                    followingUids.push(clubs.userId);
                });
            });
            const profesSnapshot = await admin.firestore()
                .collection("Fans").doc(currentUserUid).collection("professionals").get();
            profesSnapshot.forEach((doc) => {
                const followingData = doc.data().professionals;
                followingData.forEach((professionals) => {
                    followingUids.push(professionals.userId);
                });
            });
            const now = new Date(date);
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 2);
            yesterday.setHours(23, 59, 59, 999);
            const sevenDaysAgo = new Date(now);
            sevenDaysAgo.setDate(now.getDate() - 7);
            sevenDaysAgo.setHours(0, 0, 0, 0);
            const uniqueUids = Array.from(new Set(followingUids)).filter(Boolean);
            const chunkArray = (array, size) => {
                const result = [];
                for (let i = 0; i < array.length; i += size) {
                    result.push(array.slice(i, i + size));
                }
                return result;
            };
            const uidChunks = chunkArray(uniqueUids, 30);
            const postsPromises = uidChunks.map(async (uids) => {
                const postsQuery = await admin.firestore().collection("Matches")
                    .where("authorId", "in", uids)
                    .where('scheduledDate', ">=", sevenDaysAgo)
                    .where('scheduledDate', "<=", yesterday)
                    .orderBy("createdAt", "desc")
                    .get();
                return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            });
            const postsArray = await Promise.all(postsPromises);
            const posts = [].concat(...postsArray);
            const matches = await Promise.all(posts.map(async (post) => {
                const userData1 = await fetchUserData(post.club1Id);
                const userData2 = await fetchUserData(post.club2Id);
                const userData3 = await fetchUserData(post.leagueId);
                // Merge user data into the post object
                return Object.assign(Object.assign({}, post), { club1: userData1, club2: userData2, league: userData3 });
            }));
            response.json({ matches });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
//past events
exports.getPastevents =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const currentUserUid = queryParams["uid"];
            const date = queryParams["date"];
            if (!currentUserUid || !date) {
                response.status(400).json({ error: "uid and date are required" });
                return;
            }
            const followingUids = [currentUserUid];
            const clubSnapshot = await admin.firestore()
                .collection("Fans").doc(currentUserUid).collection("clubs").get();
            clubSnapshot.forEach((doc) => {
                const followingData = doc.data().clubs;
                followingData.forEach((clubs) => {
                    followingUids.push(clubs.userId);
                });
            });
            const profesSnapshot = await admin.firestore()
                .collection("Fans").doc(currentUserUid).collection("professionals").get();
            profesSnapshot.forEach((doc) => {
                const followingData = doc.data().professionals;
                followingData.forEach((professionals) => {
                    followingUids.push(professionals.userId);
                });
            });
            const now = new Date(date);
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 2);
            yesterday.setHours(23, 59, 59, 999);
            const sevenDaysAgo = new Date(now);
            sevenDaysAgo.setDate(now.getDate() - 7);
            sevenDaysAgo.setHours(0, 0, 0, 0);
            const uniqueUids = Array.from(new Set(followingUids)).filter(Boolean);
            const chunkArray = (array, size) => {
                const result = [];
                for (let i = 0; i < array.length; i += size) {
                    result.push(array.slice(i, i + size));
                }
                return result;
            };
            const uidChunks = chunkArray(uniqueUids, 30);
            const postsPromises = uidChunks.map(async (uids) => {
                const postsQuery = await admin.firestore().collection("Events")
                    .where("authorId", "in", uids)
                    .where('scheduledDate', ">=", sevenDaysAgo)
                    .where('scheduledDate', "<=", yesterday)
                    .orderBy("createdAt", "desc")
                    .get();
                return postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            });
            const postsArray = await Promise.all(postsPromises);
            const posts = [].concat(...postsArray);
            const events = await Promise.all(posts.map(async (post) => {
                const userData1 = await fetchUserData(post.authorId);
                // Merge user data into the post object
                return Object.assign(Object.assign({}, post), { author: userData1 });
            }));
            response.json({ events });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
//my matches
exports.getmymatches =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const currentUserUid = queryParams["uid"];
            if (!currentUserUid) {
                response.status(400).json({ error: "uid and date are required" });
                return;
            }
            const postsQuery = await admin.firestore().collection("Matches")
                .where("authorId", "==", currentUserUid)
                .orderBy("createdAt", "desc")
                .limit(15)
                .get();
            const matches1 = postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            const matches = await Promise.all(matches1.map(async (post) => {
                // Fetch user data for each post's authorId
                const userData1 = await fetchUserData(post.club1Id);
                const userData2 = await fetchUserData(post.club2Id);
                const userData3 = await fetchUserData(post.leagueId);
                // Merge user data into the post object
                return Object.assign(Object.assign({}, post), { club1: userData1, club2: userData2, league: userData3 });
            }));
            response.json({ matches });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
//get myevents
exports.getmyevents =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const currentUserUid = queryParams["uid"];
            if (!currentUserUid) {
                response.status(400).json({ error: "uid and date are required" });
                return;
            }
            const postsQuery = await admin.firestore().collection("Events")
                .where("authorId", "==", currentUserUid)
                .orderBy("createdAt", "desc")
                .limit(15)
                .get();
            const matches1 = postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            const events = await Promise.all(matches1.map(async (post) => {
                // Fetch user data for each post's authorId
                const userData1 = await fetchUserData(post.authorId);
                // Merge user data into the post object
                return Object.assign(Object.assign({}, post), { author: userData1 });
            }));
            response.json({ events });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
//more my matches
exports.getmoremymatches =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const currentUserUid = queryParams["uid"];
            const lastdocId = queryParams["lastdocId"];
            if (!currentUserUid || !lastdocId) {
                response.status(400).json({ error: "uid and lastdocId are required" });
                return;
            }
            const lastDoc = await admin.firestore()
                .collection('Matches').doc(lastdocId).get();
            const postsQuery = await admin.firestore().collection("Matches")
                .where("authorId", "==", currentUserUid)
                .orderBy("createdAt", "desc")
                .startAfter(lastDoc)
                .limit(10)
                .get();
            const matches1 = postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            const matches = await Promise.all(matches1.map(async (post) => {
                // Fetch user data for each post's authorId
                const userData1 = await fetchUserData(post.club1Id);
                const userData2 = await fetchUserData(post.club2Id);
                const userData3 = await fetchUserData(post.leagueId);
                // Merge user data into the post object
                return Object.assign(Object.assign({}, post), { club1: userData1, club2: userData2, league: userData3 });
            }));
            response.json({ matches });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
//get moremyevents
exports.getmoremyevents =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const currentUserUid = queryParams["uid"];
            const lastdocId = queryParams["lastdocId"];
            if (!currentUserUid || !lastdocId) {
                response.status(400).json({ error: "uid and lastdocId are required" });
                return;
            }
            const lastDoc = await admin.firestore()
                .collection('Matches').doc(lastdocId).get();
            const postsQuery = await admin.firestore().collection("Events")
                .where("authorId", "==", currentUserUid)
                .orderBy("createdAt", "desc")
                .startAfter(lastDoc)
                .limit(10)
                .get();
            const matches1 = postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            const events = await Promise.all(matches1.map(async (post) => {
                // Fetch user data for each post's authorId
                const userData1 = await fetchUserData(post.authorId);
                // Merge user data into the post object
                return Object.assign(Object.assign({}, post), { author: userData1 });
            }));
            response.json({ events });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
//getfiltermatches
//getfiltermatches
exports.getmatch =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const docId = queryParams["docId"];
            if (!docId) {
                response.status(400).json({ error: "docId is required" });
                return;
            }
            const postsQuery = await admin.firestore().collection("Matches")
                .where("matchId", "==", docId)
                .limit(1)
                .get();
            const matches1 = postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            const match = await Promise.all(matches1.map(async (post) => {
                // Fetch user data for each post's authorId
                const userData1 = await fetchUserData(post.club1Id);
                const userData2 = await fetchUserData(post.club2Id);
                const userData3 = await fetchUserData(post.leagueId);
                // Merge user data into the post object
                return Object.assign(Object.assign({}, post), { club1: userData1, club2: userData2, league: userData3 });
            }));
            const matches = match[0];
            response.json({ matches });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
//get event
exports.getevent =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const docId = queryParams["docId"];
            if (!docId) {
                response.status(400).json({ error: "docId is required" });
                return;
            }
            const postsQuery = await admin.firestore().collection("Events")
                .where("eventId", "==", docId)
                .limit(1)
                .get();
            const matches1 = postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            const event = await Promise.all(matches1.map(async (post) => {
                // Fetch user data for each post's authorId
                const userData1 = await fetchUserData(post.authorId);
                // Merge user data into the post object
                return Object.assign(Object.assign({}, post), { author: userData1 });
            }));
            const events = event[0];
            response.json({ events });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
//get filter matches
exports.getfiltermatches =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const currentUserUid = queryParams["uid"];
            const from = queryParams["from"];
            const to = queryParams["to"];
            if (!currentUserUid || !from || !to) {
                response.status(400).json({ error: "uid, from and to are required" });
                return;
            }
            const fromD = new Date(from);
            const toD = new Date(to);
            fromD.setHours(0, 0, 0, 0);
            toD.setHours(0, 0, 0, 0);
            const postsQuery = await admin.firestore().collection("Matches")
                .where("authorId", "==", currentUserUid)
                .where('scheduledDate', ">=", fromD)
                .where('scheduledDate', "<=", toD)
                .orderBy("createdAt", "desc")
                .limit(10)
                .get();
            const matches1 = postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            const matches = await Promise.all(matches1.map(async (post) => {
                // Fetch user data for each post's authorId
                const userData1 = await fetchUserData(post.club1Id);
                const userData2 = await fetchUserData(post.club2Id);
                const userData3 = await fetchUserData(post.leagueId);
                // Merge user data into the post object
                return Object.assign(Object.assign({}, post), { club1: userData1, club2: userData2, league: userData3 });
            }));
            response.json({ matches });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
//get filter events
exports.getfilterevents =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const queryParams = convertParsedQs(request.query);
            const currentUserUid = queryParams["uid"];
            const from = queryParams["from"];
            const to = queryParams["to"];
            if (!currentUserUid || !from || !to) {
                response.status(400).json({ error: "uid, from and to are required" });
                return;
            }
            const fromD = new Date(from);
            const toD = new Date(to);
            fromD.setHours(0, 0, 0, 0);
            toD.setHours(0, 0, 0, 0);
            const postsQuery = await admin.firestore().collection("Events")
                .where("authorId", "==", currentUserUid)
                .where('scheduledDate', ">=", fromD)
                .where('scheduledDate', "<=", toD)
                .orderBy("createdAt", "desc")
                .limit(10)
                .get();
            const matches1 = postsQuery.docs.map((doc) => (Object.assign({}, doc.data())));
            const events = await Promise.all(matches1.map(async (post) => {
                // Fetch user data for each post's authorId
                const userData1 = await fetchUserData(post.authorId);
                // Merge user data into the post object
                return Object.assign(Object.assign({}, post), { author: userData1 });
            }));
            response.json({ events });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
// Get likes data
exports.getlikesdata = functions.runWith({
    timeoutSeconds: 540,
}).https.onRequest(async (request, response) => {
    try {
        if (request.method !== "POST") {
            response.status(405).send({ error: "Method not allowed" });
            return;
        }
        const { docId, collection, subcollection, length } = request.body;
        if (!docId || !collection || !subcollection) {
            response.status(400).send({ error: "docId, collection, and subcollection are required" });
            return;
        }
        const likesData = [];
        const snapshot = await admin.firestore()
            .collection(collection)
            .doc(docId)
            .collection(subcollection)
            .get();
        snapshot.forEach((doc) => {
            const data = doc.data().likes || [];
            likesData.push(...data);
        });
        const slicedLikes = likesData.slice(length, length + 30);
        const likes = await Promise.all(slicedLikes.map(async (item) => {
            const userData = await fetchUserData(item.userId);
            return Object.assign(Object.assign({}, item), { author: userData });
        }));
        response.send({ likes });
    }
    catch (error) {
        console.error("Error fetching likes data:", error);
        response.status(500).send({ error: "Failed to fetch likes data" });
    }
});
// Get comments data
exports.getcommentsdata = functions.runWith({
    timeoutSeconds: 540,
}).https.onRequest(async (request, response) => {
    try {
        if (request.method !== "POST") {
            response.status(405).send({ error: "Method not allowed" });
            return;
        }
        const { docId, collection, subcollection, length } = request.body;
        if (!docId || !collection || !subcollection) {
            response.status(400).send({ error: "docId, collection, and subcollection are required" });
            return;
        }
        const commentsData = [];
        const snapshot = await admin.firestore()
            .collection(collection)
            .doc(docId)
            .collection(subcollection)
            .get();
        snapshot.forEach((doc) => {
            const data = doc.data().comments || [];
            commentsData.push(...data);
        });
        const slicedComments = commentsData.slice(length, length + 30);
        const comments = await Promise.all(slicedComments.map(async (item) => {
            const userData = await fetchUserData(item.userId);
            return Object.assign(Object.assign({}, item), { author: userData });
        }));
        response.send({ comments });
    }
    catch (error) {
        console.error("Error fetching comments data:", error);
        response.status(500).send({ error: "Failed to fetch comments data" });
    }
});
// Get replies data
exports.getreplydata = functions.runWith({
    timeoutSeconds: 540,
}).https.onRequest(async (request, response) => {
    try {
        if (request.method !== "POST") {
            response.status(405).send({ error: "Method not allowed" });
            return;
        }
        const { docId, collection, subcollection, commentId, length } = request.body;
        if (!docId || !collection || !subcollection || !commentId) {
            response.status(400).send({ error: "docId, collection, subcollection, and commentId are required" });
            return;
        }
        const repliesData = [];
        const snapshot = await admin.firestore()
            .collection(collection)
            .doc(docId)
            .collection(subcollection)
            .get();
        snapshot.forEach((doc) => {
            const data = doc.data().replies || [];
            repliesData.push(...data.filter((reply) => reply.commentId === commentId));
        });
        const slicedReplies = repliesData.slice(length, length + 30);
        const replies = await Promise.all(slicedReplies.map(async (item) => {
            const userData = await fetchUserData(item.userId);
            return Object.assign(Object.assign({}, item), { author: userData });
        }));
        response.send({ replies });
    }
    catch (error) {
        console.error("Error fetching replies data:", error);
        response.status(500).send({ error: "Failed to fetch replies data" });
    }
});
//fans,clubs,followers,following,professionals,
exports.getanydata = functions
    .runWith({
    timeoutSeconds: 540, // Adjust the timeout value as needed
})
    .https.onRequest(async (request, response) => {
    try {
        const docId = request.body.docId;
        const collectionName = request.body.collection;
        const subcollectionName = request.body.subcollection;
        const length = request.body.length;
        if (!docId || !collectionName || !subcollectionName) {
            response
                .status(400)
                .json({ error: "docId, collectionName, and subcollectionName are required" });
            return;
        }
        const profesSnapshot = await admin
            .firestore()
            .collection(collectionName)
            .doc(docId)
            .collection(subcollectionName)
            .get();
        if (subcollectionName === "notifications") {
            const notifications = [];
            profesSnapshot.forEach((doc) => {
                const dataArray = doc.data().notifications;
                if (Array.isArray(dataArray)) {
                    dataArray.forEach((notification) => {
                        notifications.push({
                            NotifiId: notification.NotifiId,
                            createdAt: notification.createdAt,
                            message: notification.message,
                            from: notification.from,
                            to: notification.to,
                            content: notification.content,
                        });
                    });
                }
            });
            const sortedNotifications = notifications
                .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
                .slice(length, length + 30);
            const data = await Promise.all(sortedNotifications.map(async (notification) => {
                const fromUserData = await fetchUserData(notification.from);
                const toUserData = await fetchUserData(notification.to);
                return {
                    NotifiId: notification.NotifiId,
                    createdAt: notification.createdAt,
                    message: notification.message,
                    from: fromUserData,
                    to: toUserData,
                    content: notification.content,
                };
            }));
            response.json({ data });
        }
        else {
            const subcollectionData = [];
            profesSnapshot.forEach((doc) => {
                const dataArray = doc.data()[subcollectionName];
                if (Array.isArray(dataArray)) {
                    dataArray.forEach((item) => {
                        subcollectionData.push({
                            userId: item.userId,
                            timestamp: item.timestamp,
                        });
                    });
                }
            });
            const sortedData = subcollectionData.slice(length, length + 30);
            const data = await Promise.all(sortedData.map(async (item) => {
                const userData = await fetchUserData(item.userId);
                return {
                    userId: item.userId,
                    timestamp: item.timestamp,
                    author: userData,
                };
            }));
            response.json({ data });
        }
    }
    catch (error) {
        console.error("Error getting data:", error);
        response.status(500).json({ error: "Failed to get data: " + error });
    }
});
//getsuggesteddata
exports.getsuggesteddata = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const currentUserUid = queryParams["uid"];
        if (!currentUserUid) {
            response.status(400).json({ error: "uid, are required" });
            return;
        }
        //let longitude;
        //let latitude;
        const userDoc = await admin.firestore().collection("Fans").doc(currentUserUid).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            if (data != undefined) {
                const latitude = data.clatitude;
                const longitude = data.clongitude;
                const following = [];
                const collectUids = (snapshot, key) => {
                    snapshot.forEach((doc) => {
                        const followingData = doc.data()[key];
                        followingData.forEach((item) => {
                            if (item.userId) {
                                following.push(item.userId);
                            }
                        });
                    });
                };
                const followingSnapshot = await admin.firestore().collection("Fans").doc(currentUserUid).collection("following").get();
                collectUids(followingSnapshot, 'following');
                const followingSnapshot1 = await admin.firestore().collection("Fans").doc(currentUserUid).collection("clubs").get();
                collectUids(followingSnapshot1, 'clubs');
                const followingSnapshot2 = await admin.firestore().collection("Fans").doc(currentUserUid).collection("professionals").get();
                collectUids(followingSnapshot2, 'professionals');
                const postsQuery = await admin.firestore().collection("Clubs")
                    .where('clatitude', ">=", latitude - 0.5)
                    .where('clatitude', "<=", latitude + 0.5)
                    .where('clongitude', ">=", longitude - 0.5)
                    .where('clongitude', "<=", longitude + 0.5)
                    .orderBy("createdAt", "desc")
                    .limit(3)
                    .get();
                const postsQuery1 = await admin.firestore().collection("Fans")
                    .where('clatitude', ">=", latitude - 0.5)
                    .where('clatitude', "<=", latitude + 0.5)
                    .where('clongitude', ">=", longitude - 0.5)
                    .where('clongitude', "<=", longitude + 0.5)
                    .orderBy("createdAt", "desc")
                    .limit(3)
                    .get();
                const postsQuery2 = await admin.firestore().collection("Professionals")
                    .where('clatitude', ">=", latitude - 0.5)
                    .where('clatitude', "<=", latitude + 0.5)
                    .where('clongitude', ">=", longitude - 0.5)
                    .where('clongitude', "<=", longitude + 0.5)
                    .orderBy("createdAt", "desc")
                    .limit(3)
                    .get();
                let users1 = postsQuery.docs.map((doc) => ({
                    userId: doc.id,
                    createdAt: doc.data().createdAt,
                    location: doc.data().Location,
                    name: doc.data().Clubname,
                    genre: doc.data().genre,
                    url: doc.data().profileimage,
                    collection: "Club",
                }));
                let users2 = postsQuery1.docs.map((doc) => ({
                    userId: doc.id,
                    createdAt: doc.data().createdAt,
                    location: doc.data().location,
                    name: doc.data().username,
                    genre: doc.data().genre,
                    url: doc.data().profileimage,
                    collection: "Fan",
                }));
                let users3 = postsQuery2.docs.map((doc) => ({
                    userId: doc.id,
                    createdAt: doc.data().createdAt,
                    location: doc.data().Location,
                    name: doc.data().Stagename,
                    genre: doc.data().genre,
                    url: doc.data().profileimage,
                    collection: "Professional",
                }));
                // Filter out users who are already being followed
                users1 = users1.filter(user => !following.includes(user.userId));
                users2 = users2.filter(user => !following.includes(user.userId));
                users3 = users3.filter(user => !following.includes(user.userId));
                const users = [...users1, ...users2, ...users3];
                response.json({ users });
            }
        }
    }
    catch (error) {
        console.error("Error getting suggetions:", error);
        response.status(500).json({ error: "Failed to get suggetions: " + error });
    }
});
// Define API URLs and collection names
//const currentDateAsString = getCurrentDateAsString();
const apiUrls = {
    football: 'https://v3.football.api-sports.io/fixtures?live=all',
    // volleyball: 'https://v1.volleyball.api-sports.io/games?date='
    // +currentDateAsString,
    // basketball: 'https://v1.basketball.api-sports.io/games?date='
    // +currentDateAsString,
    // nba:"https://v2.nba.api-sports.io/games?date="+currentDateAsString,
    // rugby:"https://v1.rugby.api-sports.io/games?date="+currentDateAsString,
    // formula1:"https://v1.formula-1.api-sports.io/races?season="
    // +currentDateAsString,
    // baseball:"https://v1.baseball.api-sports.io/games?date="+currentDateAsString,
    // handball:"https://v1.handball.api-sports.io/games?date="+currentDateAsString,
    // americanfootball:"https://v1.american-football.api-sports.io/games?date="
    // +currentDateAsString,
    // hockey:"https://v1.hockey.api-sports.io/games?date="+currentDateAsString,
    // Add more sports and their corresponding API URLs here
};
//function getCurrentDateAsString(): string {
//  const today = new Date();
//  const year = today.getFullYear();
//  const month = (today.getMonth() + 1).toString().padStart(2, '0'); 
//  const day = today.getDate().toString().padStart(2, '0');
// return `${year}-${month}-${day}`;
//}
// Usage
const collectionNames = {
    football: 'Football',
    // volleyball: 'Volleyball',
    // basketball: 'Basketball',
    // nba:"Nba",
    // rugby:"Rugby",
    // formula1:"Formula-1",
    // baseball:"Baseball",
    // handball:"Handball",
    // americanfootball:"American-football",
    // hockey:"Hockey",
    //  Add more sports and their corresponding collection names here
};
const hosts = {
    football: "v3.football.api-sports.io",
    // volleyball:"v1.volleyball.api-sports.io",
    // basketball:"v1.basketball.api-sports.io",
    // nba:"v2.nba.api-sports.io",
    // rugby:"v1.rugby.api-sports.io",
    // formula1:"v1.formula-1.api-sports.io",
    // baseball:"v1.baseball.api-sports.io",
    // handball:"v1.handball.api-sports.io",
    // americanfootball:"v1.american-football.api-sports.io",
    // hockey:"v1.hockey.api-sports.io",
};
exports.scheduledFunction = functions.pubsub
    .schedule('every 15 minutes')
    .onRun(async (context) => {
    try {
        let footballapi = "";
        // Iterate over each sport
        const apiDoc = await admin.firestore()
            .collection("APIS").doc('api').get();
        const data = apiDoc.data();
        if (data != undefined) {
            footballapi = data.footballapi;
        }
        for (const sportKey in apiUrls) {
            const sport = sportKey;
            const apiUrl = apiUrls[sport];
            const collectionName = collectionNames[sport];
            const host = hosts[sport];
            // Fetch data from the API
            // Example usage 
            const response = await axios_1.default.get(apiUrl, {
                headers: {
                    'x-rapidapi-key': footballapi,
                    'x-rapidapi-host': host, // Update host as per the sport API
                },
            });
            // Post data to Firestore collection
            await postToFirestore(collectionName, response.data.response);
        }
        console.log('Data fetched and posted successfully.');
    }
    catch (error) {
        console.error('Error fetching or posting data:', error);
    }
});
async function postToFirestore(collectionName, data) {
    const firestore = admin.firestore();
    const collectionRef = firestore.collection(collectionName);
    const querySnapshot = await collectionRef
        .orderBy('createdAt', 'desc').limit(1).get();
    const latestDoc = querySnapshot.docs[0];
    const currentDate = new Date();
    // Set the time to midnight to get the start of the current day
    currentDate.setHours(0, 0, 0, 0);
    let allMatches = [];
    let isNewDocument = true;
    const updatePromises = [];
    if (latestDoc) {
        const latestData = latestDoc.data();
        allMatches = (latestData === null || latestData === void 0 ? void 0 : latestData.matches) || [];
        const date = latestData.createdAt.toDate();
        date.setHours(0, 0, 0, 0);
        if (allMatches.length >= 2000 || date.getTime() < currentDate.getTime()) {
            isNewDocument = true;
        }
        else {
            isNewDocument = false;
        }
    }
    else {
        isNewDocument = true;
    }
    const matches = await Promise.all(data.map(async (item) => {
        const matchId = generateRandomUid(28);
        return {
            'matchId': matchId,
            'match': item,
            'Timestamp': admin.firestore.Timestamp.now(),
        };
    }));
    if (isNewDocument) {
        updatePromises.push(collectionRef.add({
            matches: matches,
            createdAt: admin.firestore.Timestamp.now(),
        }));
    }
    else {
        updatePromises.push(latestDoc.ref.update({
            matches: matches,
        }));
    }
    await Promise.all(updatePromises);
}
exports.scheduledFunction1 = functions.pubsub
    .schedule('every 15 minutes').onRun(async (context) => {
    try {
        let newsapikey = "pub_3520028c096d8fe7a45d4e8083ceee7b27b3a";
        // Iterate over each sport
        const apiDoc = await admin.firestore()
            .collection("APIS").doc('api').get();
        const data = apiDoc.data();
        if (data != undefined) {
            newsapikey = data.newsapikey;
        }
        for (const sportKey in apiUrls) {
            const sport = sportKey;
            const collectionName = collectionNames[sport];
            console.log('Collection' + collectionName);
            const baseUrl = 'https://newsdata.io/api/1/news';
            // Construct the URL with query parameters
            const apiUrl = `${baseUrl}?apikey=${newsapikey}&q=${collectionName}&language=en`;
            const response = await axios_1.default.get(apiUrl);
            let data = response.data.results;
            if (data) {
                await postToFirestore1(`${collectionName}-news`, data);
            }
            else {
                await postToFirestore1(`${collectionName}-news`, data);
            }
        }
        console.log('Data fetched and posted successfully.' + data);
    }
    catch (error) {
        console.error('Error fetching or posting data:', error);
    }
});
async function postToFirestore1(collectionName, data) {
    const firestore = admin.firestore();
    const collectionRef = firestore.collection(collectionName);
    const querySnapshot = await collectionRef
        .orderBy('createdAt', 'desc').limit(1).get();
    const latestDoc = querySnapshot.docs[0];
    const currentDate = new Date();
    // Set the time to midnight to get the start of the current day
    currentDate.setHours(0, 0, 0, 0);
    let allMatches = [];
    let isNewDocument = true;
    const updatePromises = [];
    if (latestDoc) {
        const latestData = latestDoc.data();
        allMatches = (latestData === null || latestData === void 0 ? void 0 : latestData.matches) || [];
        const date = latestData.createdAt.toDate();
        date.setHours(0, 0, 0, 0);
        if (allMatches.length >= 2000 || date.getTime() < currentDate.getTime()) {
            isNewDocument = true;
        }
        else {
            isNewDocument = false;
        }
    }
    else {
        isNewDocument = true;
    }
    const matches = await Promise.all(data.map(async (item) => {
        const matchId = generateRandomUid(28);
        return {
            'articleId': matchId,
            'article': item,
            'Timestamp': admin.firestore.Timestamp.now(),
        };
    }));
    if (isNewDocument) {
        updatePromises.push(collectionRef.add({
            news: matches,
            createdAt: admin.firestore.Timestamp.now(),
        }));
    }
    else {
        updatePromises.push(latestDoc.ref.update({
            news: matches,
        }));
    }
    await Promise.all(updatePromises);
}
//League comments
exports.getLeagueComments =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const docId = request.body.docId;
            const year = request.body.year;
            const length = request.body.length;
            if (!docId || !year) {
                response.status(400).json({
                    error: "docId, collectionName and subcollectionName are required"
                });
                return;
            }
            const replies1 = [];
            const profesSnapshot = await admin.firestore()
                .collection('Leagues')
                .doc(docId)
                .collection('year')
                .doc(year)
                .collection('comments')
                .get();
            profesSnapshot.forEach((doc) => {
                const followingData = doc.data().comments;
                followingData.forEach((professionals) => {
                    replies1.push({
                        userId: professionals.userId,
                        createdAt: professionals.createdAt,
                        comment: professionals.comment,
                        commentId: professionals.commentId,
                    });
                });
            });
            const slicedReplies = replies1.slice(length, length + 30);
            const comments = await Promise.all(slicedReplies.map(async (d) => {
                const userData1 = await fetchUserData(d.userId);
                return {
                    userId: d.userId,
                    createdAt: d.createdAt,
                    comment: d.comment,
                    commentId: d.commentId,
                    author: userData1,
                };
            }));
            response.json({ comments });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
//league comments replies
exports.getLeagueCommentsreplies =
    functions.runWith({
        timeoutSeconds: 540 // Adjust the timeout value as needed
    }).https.onRequest(async (request, response) => {
        try {
            const docId = request.body.docId;
            const year = request.body.year;
            const commentId = request.body.commentId;
            const length = request.body.length;
            if (!docId || !year || !commentId) {
                response.status(400).json({
                    error: "docId, year and commentId are required"
                });
                return;
            }
            const replies1 = [];
            const profesSnapshot = await admin.firestore()
                .collection('Leagues')
                .doc(docId)
                .collection('year')
                .doc(year)
                .collection('replies')
                .get();
            // Collect all replies into replies1
            profesSnapshot.forEach((doc) => {
                const followingData = doc.data().replies;
                followingData.forEach((professionals) => {
                    replies1.push({
                        userId: professionals.userId,
                        createdAt: professionals.createdAt,
                        reply: professionals.reply,
                        commentId: professionals.commentId,
                        replyId: professionals.replyId,
                    });
                });
            });
            // Filter replies by commentId and then slice based on the length
            const slicedReplies = replies1
                .filter((professionals) => professionals.commentId == commentId) // Filter by commentId
                .slice(length, length + 30); // Slice the filtered array based on the range
            const replies = await Promise.all(slicedReplies.map(async (d) => {
                const userData1 = await fetchUserData(d.userId);
                return {
                    userId: d.userId,
                    createdAt: d.createdAt,
                    reply: d.reply,
                    commentId: d.commentId,
                    replyId: d.replyId,
                    author: userData1,
                };
            }));
            response.json({ replies });
        }
        catch (error) {
            console.error("Error getting posts:", error);
            response.status(500).json({ error: "Failed to get posts" + error });
        }
    });
exports.backDelete = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }
        const data = req.body;
        const converterId = data.converterId;
        // const streamId = data.streamId; 
        // Delete Agora RTMP Converter if converterId is provided
        if (converterId !== undefined) {
            const agoraUrl = `https://api.agora.io/eu/v1/projects/${data.agoraapi}/rtmp-converters/${converterId}`;
            try {
                const response = await axios_1.default.delete(agoraUrl, {
                    auth: {
                        username: data.agorakey,
                        password: data.agorasecret,
                    }
                });
                if (response.status === 200 || response.status === 204) {
                    const agoraapis = await admin.firestore().collection(data.collection).doc(data.matchId).get();
                    await agoraapis.ref.update({
                        isLive: false,
                        stoptime: admin.firestore.Timestamp.now()
                    }); // Check for 200 or 204 status codes
                    console.log('RTMP Converter deleted successfully');
                }
                else {
                    const agoraapis = await admin.firestore().collection(data.collection).doc(data.matchId).get();
                    await agoraapis.ref.update({
                        isLive: false,
                        stoptime: admin.firestore.Timestamp.now()
                    });
                    console.error(`Failed to delete RTMP Converter. Status code: ${response.status}`);
                }
            }
            catch (error) {
                console.error('Error deleting RTMP Converter:', error);
            }
        }
        res.json({ replies: {} });
    }
    catch (error) {
        console.error("Error processing request:", error);
        res.status(500).json({ error: "Failed to process request: " + error });
    }
});
app.use(bodyParser.json());
exports.stopMatchesEvents = functions.pubsub.schedule('every 15 minutes').onRun(async (context) => {
    try {
        const agoraapis = await admin.firestore().collection("APIS").doc('api').get();
        const data = agoraapis.data();
        if (data !== undefined) {
            const agoraapi = data.agoraapi;
            const agorakey = data.agorakey;
            const agorasecret = data.agorasecret;
            const t = new Date();
            const today = new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours() - 3, t.getMinutes());
            const matches = await admin.firestore().collection('Matches')
                .where("isLive", '==', true)
                .where("starttime", '<', today)
                .orderBy('createdAt', 'asc')
                .get();
            const updatePromises = matches.docs.map(async (doc) => {
                const data = doc.data();
                const starttime = data.starttime.toDate();
                const durationSeconds = Math.floor((Date.now() - starttime.getTime()) / 1000);
                await doc.ref.update({
                    state1: "0",
                    state2: "0",
                    duration: durationSeconds,
                    message: "match stopped time limit exceeded",
                    stoptime: admin.firestore.Timestamp.now()
                });
                const converterId = data.converterId;
                if (converterId != undefined) {
                    const url = `https://api.agora.io/eu/v1/projects/${agoraapi}/rtmp-converters/${converterId}`;
                    try {
                        const response = await axios_1.default.delete(url, {
                            auth: {
                                username: agorakey,
                                password: agorasecret,
                            }
                        });
                        if (response.status === 200) {
                            console.log('RTMP Converter deleted successfully');
                        }
                        else {
                            console.error(`Failed to delete RTMP Converter. Status code: ${response.status}`);
                        }
                    }
                    catch (error) {
                        console.error('Error deleting RTMP Converter:', error);
                    }
                }
            });
            const events = await admin.firestore().collection('Events')
                .where("isLive", '==', true)
                .where("starttime", '<', today)
                .orderBy('createdAt', 'asc')
                .get();
            const updatePromises1 = events.docs.map(async (doc) => {
                const data = doc.data();
                const starttime = data.starttime.toDate();
                const durationSeconds = Math.floor((Date.now() - starttime.getTime()) / 1000);
                await doc.ref.update({
                    state1: "0",
                    state2: "0",
                    duration: durationSeconds,
                    message: "event stopped time limit exceeded",
                    stoptime: admin.firestore.Timestamp.now()
                });
                const converterId = data.converterId;
                if (converterId != undefined) {
                    const url = `https://api.agora.io/eu/v1/projects/${agoraapi}/rtmp-converters/${converterId}`;
                    try {
                        const response = await axios_1.default.delete(url, {
                            auth: {
                                username: agorakey,
                                password: agorasecret,
                            }
                        });
                        if (response.status === 200) {
                            console.log('RTMP Converter deleted successfully');
                        }
                        else {
                            console.error(`Failed to delete RTMP Converter. Status code: ${response.status}`);
                        }
                    }
                    catch (error) {
                        console.error('Error deleting RTMP Converter:', error);
                    }
                }
            });
            await Promise.all(updatePromises);
            await Promise.all(updatePromises1);
        }
    }
    catch (error) {
        console.error("error", error);
    }
});
exports.addSignInData = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const data = req.body;
    if (!data || !data.collection || !data.userId || !data.location) {
        res.status(400).send('Bad Request: Missing required fields');
        return;
    }
    try {
        const docRef = await db.collection(data.collection).doc(data.userId).get();
        await docRef.ref.update({
            fcmToken: data.fcmToken,
            onlinestatus: 1,
            lastonlinetimestamp: admin.firestore.Timestamp.now(),
            devicemodel: data.location.devicemodel,
            fcmcreatedAt: admin.firestore.Timestamp.now(),
            ctimestamp: admin.firestore.Timestamp.now(),
            clongitude: data.location.longitude,
            clatitude: data.location.latitude,
            userversion: data.userversion,
        });
        const querySnapshot = await docRef.ref.collection("locations").orderBy('createdAt', 'desc').limit(1).get();
        let allNotifications = [];
        let isNewDocument = true;
        if (!querySnapshot.empty) {
            const latestDoc = querySnapshot.docs[0];
            const latestData = latestDoc.data();
            allNotifications = (latestData === null || latestData === void 0 ? void 0 : latestData.location) || [];
            if (allNotifications.length < 4000) {
                isNewDocument = false;
            }
        }
        const location = Object.assign(Object.assign({}, data.location), { 'timestamp': admin.firestore.Timestamp.now() });
        if (isNewDocument) {
            await docRef.ref.collection('locations').add({
                location: [location],
                createdAt: admin.firestore.Timestamp.now(),
            });
        }
        else {
            const latestDoc = querySnapshot.docs[0];
            await latestDoc.ref.update({
                location: [...allNotifications, location],
            });
        }
        //let username:string='';
        //let imageUrl:string='';
        // Fetch user data for the current user
        const userData = await fetchUserData(data.userId);
        if (userData !== undefined) {
            const token = userData.token;
            const otherUserId = userData.userId;
            const username = userData.username;
            const collection = userData.collectionName;
            sendEmail1(data.email, username, collection);
            if (token) {
                const message = {
                    notification: {
                        title: 'Welcome Back to Fans Arena',
                        body: `You Logged in as a ${userData.collectionName}, ${userData.username}`,
                    },
                    data: {
                        click_action: "FLUTTER_NOTIFICATION_CLICK",
                        tab: "/Login",
                    },
                    android: {
                        notification: {
                            sound: "default",
                            image: '',
                        },
                    },
                    token,
                };
                console.log(`You Logged in as a ${userData.collectionName} ${userData.username}`);
                await sendANotification(message);
                await addANotification(userData.docRef, data.userId, otherUserId, "", 'welcome back to Fans Arena');
            }
        }
        res.status(200).send('200');
    }
    catch (error) {
        console.error('Error adding data:', error);
        res.status(500).send('Internal Server Error');
    }
});
exports.addSignOutData = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const data = req.body;
    if (!data || !data.collection || !data.userId) {
        res.status(400).send('Bad Request: Missing required fields');
        return;
    }
    try {
        const docRef = await db.collection(data.collection).doc(data.userId).get();
        await docRef.ref.update({
            fcmToken: "",
            onlinestatus: 0,
            lastonlinetimestamp: admin.firestore.Timestamp.now(),
        });
        res.status(200).send('200');
    }
    catch (error) {
        console.error('Error adding data:', error);
        res.status(500).send('Internal Server Error');
    }
});
const allDataList = [];
exports.addData = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const data = req.body;
    if (!data || !data.collection || !data.docId || !data.subcollection || !data.data) {
        res.status(400).send('Bad Request: Missing required fields');
        return;
    }
    try {
        allDataList.push({
            collection: data.collection,
            docId: data.docId,
            subcollection: data.subcollection,
            subdocId: data.subdocId,
            subcollection1: data.subcollection1,
            data: data.data,
        });
        console.log('Data added to allDataList:', allDataList);
        if (allDataList.length > 0) {
            await processPostData();
        }
        res.status(200).send('200');
    }
    catch (error) {
        console.error('Error adding data:', error);
        res.status(500).send('Internal Server Error');
    }
});
exports.fetchtableData = functions.runWith({
    timeoutSeconds: 540, // Adjust the timeout as needed
}).https.onRequest(async (request, response) => {
    try {
        // Ensure request method is POST
        if (request.method !== "POST") {
            response.status(405).json({ error: "Method Not Allowed. Use POST instead." });
            return;
        }
        // Parse request body
        const data = request.body;
        const { collection, userId, year } = data;
        // Validate request body
        if (!userId) {
            response.status(400).json({ error: "userId is required in the request body." });
            return;
        }
        // Initialize containers for results
        const docIds = [];
        const dRows = [];
        const tableColumns = [];
        if (collection === "Clubs") {
            // Query Firestore for Clubs data
            const clubSnapshot = await admin.firestore()
                .collection("Clubs")
                .doc(userId)
                .collection("clubsteam")
                .get();
            if (!clubSnapshot.empty) {
                for (const doc of clubSnapshot.docs) {
                    docIds.push(doc.id);
                    const clubsteam = doc.data()["clubsteam"] || [];
                    const clubsTeamTable = doc.data()["clubsTeamTable"] || [];
                    // Enrich clubsTeamTable data
                    const enrichedTable = await enrichTeamData(clubsteam, clubsTeamTable);
                    dRows.push(...enrichedTable);
                    tableColumns.push(...clubsTeamTable);
                }
                response.status(200).json({ tableData: { docIds, dRows, tableColumns } });
            }
            else {
                response.status(200).json({ tableData: { docIds, dRows, tableColumns } });
            }
        }
        else if (collection === "Leagues") {
            // Query Firestore for Leagues data
            const leagueSnapshot = await admin.firestore()
                .collection("Leagues")
                .doc(userId)
                .collection("year")
                .doc(year)
                .get();
            if (leagueSnapshot.exists) {
                const leagueData = leagueSnapshot.data();
                const leagueTable = (leagueData === null || leagueData === void 0 ? void 0 : leagueData[data.table]) || [];
                if (data.subcollection == "clubs") {
                    const clubSnapshot = await admin.firestore()
                        .collection("Leagues")
                        .doc(userId)
                        .collection("year")
                        .doc(year)
                        .collection(data.subcollection)
                        .get();
                    if (!clubSnapshot.empty) {
                        for (const doc of clubSnapshot.docs) {
                            docIds.push(doc.id);
                            const clubs = doc.data()[data.data] || [];
                            // Enrich clubsTeamTable data
                            const enrichedTable = await enrichTeamData(clubs, leagueTable);
                            dRows.push(...enrichedTable);
                            tableColumns.push(...leagueTable);
                        }
                        response.status(200).json({ tableData: { docIds, dRows, tableColumns } });
                    }
                    else {
                        response.status(200).json({ tableData: { docIds, dRows, tableColumns } });
                    }
                }
                else {
                    const clubSnapshot = await admin.firestore()
                        .collection("Leagues")
                        .doc(userId)
                        .collection("year")
                        .doc(year)
                        .collection(data.subcollection)
                        .get();
                    if (!clubSnapshot.empty) {
                        for (const doc of clubSnapshot.docs) {
                            docIds.push(doc.id);
                            const clubs = doc.data()[data.data] || [];
                            // Enrich clubsTeamTable data
                            const enrichedTable = await enrichTeamData1(clubs, leagueTable);
                            dRows.push(...enrichedTable);
                            tableColumns.push(...leagueTable);
                        }
                        response.status(200).json({ tableData: { docIds, dRows, tableColumns } });
                    }
                    else {
                        response.status(200).json({ tableData: { docIds, dRows, tableColumns } });
                    }
                }
            }
            else {
                response.status(200).json({ tableData: { docIds, dRows, tableColumns } });
            }
        }
        else {
            response.status(400).json({ error: "Invalid collection specified. Use 'Clubs' or 'Leagues'." });
        }
    }
    catch (error) {
        console.error("Error fetching table data:", error);
        response.status(500).json({ error: "Failed to fetch table data. " + error });
    }
});
// Helper function to enrich team data with user data
async function enrichTeamData(clubsteam, clubsTeamTable) {
    const enrichedTable = [];
    for (const team of clubsteam) {
        const fnField = clubsTeamTable[1].fn;
        if (fnField && team[fnField]) {
            const userId = team[fnField];
            const userData = await fetchUserData(userId);
            enrichedTable.push(Object.assign(Object.assign({}, team), { [fnField]: userData }));
        }
    }
    return enrichedTable;
}
async function enrichTeamData1(scorers, scorersTable) {
    const enrichedTable = [];
    for (const team of scorers) {
        const fnField = scorersTable[1].fn;
        const fnField1 = scorersTable[2].fn;
        if (fnField && team[fnField]) {
            const userId = team[fnField];
            const userData = await fetchUserData(userId);
            const doc = await userData.docRef.collection("club").get();
            if (doc.empty) {
                enrichedTable.push(Object.assign(Object.assign({}, team), { [fnField]: userData }));
            }
            else {
                const clubId = doc.docs[0].id;
                const userData1 = await fetchUserData(clubId);
                enrichedTable.push(Object.assign(Object.assign({}, team), { [fnField]: userData, [fnField1]: userData1 }));
            }
        }
    }
    return enrichedTable;
}
exports.processaddData = functions.runWith({ memory: '128MB', timeoutSeconds: 540 }).pubsub.schedule('every 1 minutes').onRun(async () => {
    await processPostData();
    //const agoraapis = await admin.firestore().collection("APIS").doc('api').get();
    //const data = agoraapis.data();
    //await updateEmptyThumbnails(data);
    //await updateEmptyThumbnails1(data);
    //await updateEmptyThumbnails2(data);
});
exports.optimize = functions.runWith({ memory: '128MB', timeoutSeconds: 540 }).pubsub.schedule('every 720 hours').onRun(async () => {
    await optimizeAllCollections();
});
/**
* Transfers data to previous subcollection documents if their array size is less than 3000.
* Runs for multiple collections and subcollections based on the provided list.
*/
/**
* Transfers data to previous subcollection documents if their array size is less than 3000.
* Runs for multiple collections and subcollections based on the provided list.
*/
async function optimizeAllCollections() {
    const collections = ["FansTv", "Matches", "Events", "posts", "Story", "Chats", "Groups", "Fans", "Clubs", "Professionals"];
    const subcollections = [
        "comments",
        "likes",
        "views",
        "donations",
        "tickets",
        "replies",
        "chat",
        "commentlikes",
        "replylikes",
        "fans",
        "following",
        "followers",
        "locations",
        "notifications",
        "savedFansTv",
        "savedposts",
        "clubs",
        "professionals"
    ];
    for (const collection of collections) {
        for (const subcollection of subcollections) {
            try {
                console.log(`Optimizing ${collection}/${subcollection}`);
                // Fetch all document IDs in the main collection based on a query
                const collectionSnapshot = await admin.firestore().collection(collection).get();
                if (collectionSnapshot.empty) {
                    console.log(`No documents found in collection ${collection}.`);
                    continue;
                }
                const docIds = collectionSnapshot.docs.map(doc => doc.id);
                for (const docId of docIds) {
                    await optimizeSubcollectionArray(collection, docId, subcollection, subcollection);
                }
            }
            catch (error) {
                console.error(`Error processing ${collection}/${subcollection}:`, error);
            }
        }
    }
}
async function optimizeSubcollectionArray(collectionPath, docId, subcollection, fieldName) {
    try {
        // Fetch all documents in the subcollection ordered by `createdAt`.
        const querySnapshot = await admin
            .firestore()
            .collection(collectionPath)
            .doc(docId)
            .collection(subcollection)
            .orderBy("createdAt", 'asc')
            .get();
        if (querySnapshot.empty) {
            console.log(`No documents found in subcollection ${subcollection} for document ${docId}.`);
            return;
        }
        const docs = querySnapshot.docs;
        if (docs.length > 1) {
            let allItems = [];
            // Collect all items from all documents
            for (const doc of docs) {
                const data = doc.data();
                const array = data[fieldName] || [];
                allItems.push(...array);
                console.log(`Collected ${array.length} items from doc ${doc.id}.`);
            }
            console.log(`Total items collected: ${allItems.length}`);
            if (allItems.length > 3000) {
                // Redistribute items across documents
                let currentIndex = 0;
                for (const doc of docs) {
                    const availableSpace = 3000;
                    const itemsToAdd = allItems.slice(currentIndex, currentIndex + availableSpace);
                    currentIndex += itemsToAdd.length;
                    let createdAt = doc.data().createdAt;
                    if (createdAt == undefined) {
                        createdAt = admin.firestore.Timestamp.now();
                    }
                    await doc.ref.update({
                        [fieldName]: itemsToAdd, createdAt: createdAt
                    });
                    console.log(`Updated doc ${doc.id} with ${itemsToAdd.length} items.`);
                    if (currentIndex >= allItems.length) {
                        break;
                    }
                }
                // If there are any remaining documents, set their arrays to empty
                for (let i = Math.ceil(allItems.length / 3000); i < docs.length; i++) {
                    await docs[i].ref.delete();
                    console.log(`Cleared items in doc ${docs[i].id}.`);
                }
            }
            else {
                // If allItems is <= 3000, add directly to the oldest document and clear the rest
                let createdAt = docs[0].data().createdAt;
                if (createdAt == undefined) {
                    createdAt = admin.firestore.Timestamp.now();
                }
                await docs[0].ref.update({
                    [fieldName]: allItems,
                    createdAt: createdAt,
                });
                console.log(`Updated doc ${docs[0].id} with all ${allItems.length} items.`);
                // Clear the remaining documents
                for (let i = 1; i < docs.length; i++) {
                    await docs[i].ref.delete();
                    console.log(`Cleared items in doc ${docs[i].id}.`);
                }
            }
        }
        console.log(`Optimization complete for ${collectionPath}/${docId}/${subcollection}.`);
    }
    catch (error) {
        console.error('Error optimizing subcollection arrays:', error);
    }
}
// Example usage:
// optimizeAllCollections().then(() => console.log('Optimization process complete.'));
// Example usage:
// optimizeAllCollections().then(() => console.log('Optimization process complete.'));
const os = require('os');
async function generateAndUploadThumbnail(videoUrl) {
    try {
        const agoraapis = await admin.firestore().collection("APIS").doc("api").get();
        const data = agoraapis.data();
        if (!data || !data.cloudinaryname || !data.cloudinaryapikey || !data.cloudinarysecret) {
            console.error("Cloudinary API configuration is incomplete or missing.");
            throw new Error("Cloudinary API configuration is missing.");
        }
        cloudinary_1.v2.config({
            cloud_name: data.cloudinaryname,
            api_key: data.cloudinaryapikey,
            api_secret: data.cloudinarysecret,
        });
        const tmpDir = os.tmpdir();
        const outputPath = path_1.default.join(tmpDir, `thumbnail-${Date.now()}.jpg`);
        console.log("Output Path:", outputPath);
        const secureUrl = await new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)(videoUrl)
                .screenshots({
                timestamps: [1],
                filename: path_1.default.basename(outputPath),
                folder: path_1.default.dirname(outputPath),
                size: "300x?",
            })
                .on("start", (commandLine) => console.log("FFmpeg Command:", commandLine))
                .on("stderr", (stderrLine) => console.log(`FFmpeg STDERR: ${stderrLine}`))
                .on("end", async () => {
                console.log(`Thumbnail generated at: ${outputPath}`);
                try {
                    const result = await cloudinary_1.v2.uploader.upload(outputPath, {
                        resource_type: "image",
                        folder: "thumbnails",
                    });
                    console.log("Uploaded to Cloudinary:", result.secure_url);
                    fs_1.default.unlinkSync(outputPath);
                    console.log(`Deleted local file: ${outputPath}`);
                    resolve(result.secure_url);
                }
                catch (error) {
                    console.error("Cloudinary upload error:", error);
                    fs_1.default.existsSync(outputPath) && fs_1.default.unlinkSync(outputPath);
                    reject(new Error(`Failed to upload thumbnail: ${error}`));
                }
            })
                .on("error", (error) => {
                console.error("FFmpeg Error:", error.message);
                reject(new Error(`FFmpeg failed: ${error.message}`));
            });
        });
        return secureUrl;
    }
    catch (error) {
        console.error("Error generating and uploading thumbnail:", error);
        throw error;
    }
}
async function processPostData() {
    var _a, _b;
    if (allDataList.length === 0) {
        console.log('Queue is empty. No data to process.');
        return;
    }
    try {
        while (allDataList.length > 0) {
            const item = allDataList.shift();
            console.log('Processing item:', item);
            if (item) {
                if (item.collection == "Leagues") {
                    let notifications = [];
                    let data;
                    let createdAt;
                    let latestDoc;
                    let querySnapshot;
                    let isNewDocument = true;
                    //let subcollection = item.subcollection;
                    let subcollection1 = "";
                    data = Object.assign(Object.assign({}, item.data), { createdAt: admin.firestore.Timestamp.now() });
                    if (item.subcollection == "visits") {
                        subcollection1 = item.subcollection;
                        querySnapshot = await admin.firestore().collection(item.collection).doc(item.docId)
                            .collection(item.subcollection).orderBy('createdAt', 'desc').limit(1).get();
                    }
                    else {
                        subcollection1 = item.subcollection1;
                        querySnapshot = await admin.firestore().collection(item.collection).doc(item.docId)
                            .collection(item.subcollection).doc(item.subdocId).collection(item.subcollection1).orderBy('createdAt', 'desc').limit(1).get();
                    }
                    if (!querySnapshot.empty) {
                        latestDoc = querySnapshot.docs[0];
                        const docData = latestDoc.data();
                        if (docData) {
                            createdAt = docData.createdAt;
                            notifications = docData[subcollection1] || [];
                            // Check for empty strings in the notifications array
                            notifications = notifications.filter((notification) => notification !== "");
                            if (notifications.length < 3000) {
                                isNewDocument = false;
                            }
                        }
                    }
                    if (isNewDocument) {
                        console.log('Creating new document for:', subcollection1);
                        if (item.subcollection == "visits") {
                            await admin.firestore().collection(item.collection).doc(item.docId)
                                .collection(subcollection1).add({
                                [subcollection1]: [data],
                                createdAt: admin.firestore.Timestamp.now(),
                            });
                        }
                        else {
                            await admin.firestore().collection(item.collection).doc(item.docId)
                                .collection(item.subcollection).doc(item.subdocId).collection(subcollection1).add({
                                [subcollection1]: [data],
                                createdAt: admin.firestore.Timestamp.now(),
                            });
                        }
                    }
                    else if (latestDoc) { // Ensure latestDoc is defined before updating
                        // Prepare the update data
                        const updateData = {
                            [subcollection1]: [...notifications, data],
                        };
                        // Ensure 'createdAt' field exists in the existing document
                        if (!createdAt) {
                            updateData.createdAt = admin.firestore.Timestamp.now();
                        }
                        console.log('Updating existing document for:', subcollection1);
                        await latestDoc.ref.update(updateData);
                    }
                }
                else if (item.subcollection == "views" || item.subcollection == "adViews") {
                    // const notifications = [];
                    const { collection, docId, subcollection, data } = item;
                    const data1 = Object.assign(Object.assign({}, data), { timestamp: admin.firestore.Timestamp.now() });
                    const querySnapshot = await admin
                        .firestore()
                        .collection(collection)
                        .doc(docId)
                        .collection(subcollection)
                        .orderBy("createdAt", "desc")
                        .get();
                    if (querySnapshot.docs.length > 0) {
                        let isUpdated = false;
                        const updatePromises = [];
                        for (const doc of querySnapshot.docs) {
                            let views = ((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.views) || [];
                            const matchingViewIndex = collection === "Story"
                                ? views.findIndex((view) => view.userId === data1.userId && view.storyId === data1.storyId)
                                : views.findIndex((view) => view.userId === data1.userId);
                            if (matchingViewIndex !== -1) {
                                const matchingView = views[matchingViewIndex];
                                const updatedWatchhours = (matchingView.watchhours || 0) + data1.watchhours;
                                const updatedTimestamp = matchingView.timestamp instanceof admin.firestore.Timestamp &&
                                    matchingView.timestamp.toMillis() < data1.timestamp.toMillis()
                                    ? matchingView.timestamp
                                    : data1.timestamp;
                                views[matchingViewIndex] = Object.assign(Object.assign({}, matchingView), { watchhours: updatedWatchhours, timestamp: updatedTimestamp });
                                updatePromises.push(doc.ref.update({ views }));
                                isUpdated = true;
                            }
                        }
                        await Promise.all(updatePromises);
                        if (!isUpdated) {
                            const latestDoc = querySnapshot.docs[0];
                            if (latestDoc && latestDoc.data()) {
                                const views = ((_b = latestDoc.data()) === null || _b === void 0 ? void 0 : _b.views) || [];
                                if (views.length < 3000) {
                                    // Add the new data to the existing views array
                                    await latestDoc.ref.update({
                                        views: [...views, data1],
                                    });
                                }
                                else {
                                    // Create a new document if the views array is full
                                    await admin
                                        .firestore()
                                        .collection(collection)
                                        .doc(docId)
                                        .collection(subcollection)
                                        .add({
                                        views: [data1],
                                        createdAt: admin.firestore.Timestamp.now(),
                                    });
                                }
                            }
                            else {
                                // Handle the case where there is no data in the latest document
                                await admin
                                    .firestore()
                                    .collection(collection)
                                    .doc(docId)
                                    .collection(subcollection)
                                    .add({
                                    views: [data1],
                                    createdAt: admin.firestore.Timestamp.now(),
                                });
                            }
                        }
                    }
                    else {
                        // Handle the case where the collection is empty
                        await admin
                            .firestore()
                            .collection(collection)
                            .doc(docId)
                            .collection(subcollection)
                            .add({
                            views: [data1],
                            createdAt: admin.firestore.Timestamp.now(),
                        });
                    }
                }
                else {
                    let notifications = [];
                    let data;
                    let createdAt;
                    let latestDoc;
                    let isNewDocument = true;
                    let subcollection = item.subcollection;
                    const querySnapshot = await admin.firestore().collection(item.collection).doc(item.docId)
                        .collection(item.subcollection).orderBy('createdAt', 'desc').limit(1).get();
                    if (item.subcollection === 'comments' || item.subcollection === 'replies') {
                        data = Object.assign(Object.assign({}, item.data), { createdAt: admin.firestore.Timestamp.now() });
                    }
                    else {
                        data = Object.assign(Object.assign({}, item.data), { timestamp: admin.firestore.Timestamp.now() });
                    }
                    if (!querySnapshot.empty) {
                        latestDoc = querySnapshot.docs[0];
                        const docData = latestDoc.data();
                        if (docData) {
                            createdAt = docData.createdAt;
                            if (item.subcollection === "likes") {
                                // Aggregate all likes from all documents in the query snapshot
                                for (const doc of querySnapshot.docs) {
                                    const docArray = doc.data()[item.subcollection] || [];
                                    notifications.push(...docArray);
                                }
                                // Filter out empty strings from the notifications array
                                notifications = notifications.filter((notification) => notification !== "");
                            }
                            else {
                                // Populate notifications with only doc[0] for non-likes
                                notifications = docData[item.subcollection] || [];
                            }
                            if (notifications.length < 3000) {
                                isNewDocument = false;
                            }
                        }
                    }
                    if (item.subcollection === "likes") {
                        const data = Object.assign(Object.assign({}, item.data), { timestamp: admin.firestore.Timestamp.now() });
                        // Check if userId already exists in the aggregated notifications array
                        const userIdExists = notifications.some((notification) => notification.userId === data.userId);
                        if (!userIdExists) {
                            if (isNewDocument) {
                                console.log('Creating new document for:', item.subcollection);
                                await admin.firestore().collection(item.collection).doc(item.docId)
                                    .collection(item.subcollection).add({
                                    [subcollection]: [data],
                                    createdAt: admin.firestore.Timestamp.now(),
                                });
                            }
                            else if (latestDoc) {
                                const docData = latestDoc.data();
                                if (docData) {
                                    const updateData = {
                                        [subcollection]: [...docData[subcollection], data],
                                    };
                                    if (!createdAt) {
                                        updateData.createdAt = admin.firestore.Timestamp.now();
                                    }
                                    console.log('Updating existing document for:', item.subcollection);
                                    await latestDoc.ref.update(updateData);
                                }
                            }
                            else {
                                console.log('User ID already exists in likes, not adding entry.');
                            }
                        }
                    }
                    else {
                        if (isNewDocument) {
                            console.log('Creating new document for:', item.subcollection);
                            await admin.firestore().collection(item.collection).doc(item.docId)
                                .collection(item.subcollection).add({
                                [subcollection]: [data],
                                createdAt: admin.firestore.Timestamp.now(),
                            });
                        }
                        else if (latestDoc) {
                            const updateData = {
                                [subcollection]: [...notifications, data],
                            };
                            if (!createdAt) {
                                updateData.createdAt = admin.firestore.Timestamp.now();
                            }
                            console.log('Updating existing document for:', item.subcollection);
                            await latestDoc.ref.update(updateData);
                        }
                    }
                }
            }
        }
        console.log('Data processing complete.');
    }
    catch (error) {
        console.error('Error processing data:', error);
    }
}
exports.matchData = functions.runWith({
    timeoutSeconds: 540, // Adjust the timeout value as needed
}).https.onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const docId = queryParams["docId"];
        const collection = queryParams["collection"];
        if (!docId || !collection) {
            response.status(400).send("Missing query parameters: docId and collection are required.");
            return;
        }
        // Retrieve the match document
        const matchDoc = await admin.firestore().collection(collection).doc(docId).get();
        if (!matchDoc.exists) {
            response.status(404).send("Match document not found");
            return;
        }
        const matchData = matchDoc.data();
        if (!matchData) {
            response.status(404).send("No match data found");
            return;
        }
        const price = matchData.price;
        const currency = matchData.currency;
        // Retrieve sub-collections: likes, views, donations, and tickets
        const matchLikesSnapshot = await admin.firestore().collection(collection).doc(docId).collection("likes").get();
        const matchViewsSnapshot = await admin.firestore().collection(collection).doc(docId).collection("views").get();
        const matchDonationsSnapshot = await admin.firestore().collection(collection).doc(docId).collection("donations").get();
        const matchTicketsSnapshot = await admin.firestore().collection(collection).doc(docId).collection("tickets").get();
        const matchAdViewsSnapshot = await admin.firestore().collection(collection).doc(docId).collection("adViews").get();
        // Process match data
        const matchLikes = [];
        if (!matchLikesSnapshot.empty) {
            matchLikesSnapshot.forEach((doc) => {
                const likesList = doc.data().likes || [];
                likesList.forEach((like) => {
                    matchLikes.push({
                        userId: like.userId,
                        timestamp: like.timestamp,
                    });
                });
            });
        }
        const matchTickets = [];
        if (!matchTicketsSnapshot.empty) {
            matchTicketsSnapshot.forEach((doc) => {
                const ticketsList = doc.data().likes || [];
                ticketsList.forEach((ticket) => {
                    matchTickets.push({
                        userId: ticket.userId,
                        timestamp: ticket.timestamp,
                    });
                });
            });
        }
        const matchViews = [];
        if (!matchViewsSnapshot.empty) {
            matchViewsSnapshot.forEach((doc) => {
                const viewsList = doc.data().views || [];
                viewsList.forEach((view) => {
                    matchViews.push({
                        userId: view.userId,
                        timestamp: view.timestamp,
                        watchhours: view.watchhours,
                    });
                });
            });
        }
        const matchadViews = [];
        if (!matchViewsSnapshot.empty) {
            matchAdViewsSnapshot.forEach((doc) => {
                const viewsList = doc.data().views || [];
                viewsList.forEach((view) => {
                    matchadViews.push({
                        userId: view.userId,
                        timestamp: view.timestamp,
                        watchhours: view.watchhours,
                    });
                });
            });
        }
        const matchDonations = [];
        if (!matchDonationsSnapshot.empty) {
            matchDonationsSnapshot.forEach((doc) => {
                const donationsList = doc.data().donations || [];
                donationsList.forEach((donation) => {
                    matchDonations.push({
                        transactionId: donation.transactionId,
                        timestamp: donation.timestamp,
                        amount: donation.amount,
                    });
                });
            });
        }
        // Initialize arrays to count likes, views, watch hours, and donations per two-hour interval
        const intervalsInDay = 12; // 24 hours divided by 2
        const likesPerInterval = Array(intervalsInDay).fill(0);
        const ticketsPerInterval = Array(intervalsInDay).fill(0);
        const viewsPerInterval = Array(intervalsInDay).fill(0);
        const adViewsPerInterval = Array(intervalsInDay).fill(0);
        const watchhoursPerInterval = Array(intervalsInDay).fill(0);
        const adWatchhoursPerInterval = Array(intervalsInDay).fill(0);
        const donationsPerInterval = Array(intervalsInDay).fill(0);
        const amountPerInterval = Array(intervalsInDay).fill(0);
        // Helper function to get the two-hour interval of the day from a timestamp
        const getIntervalOfDay = (timestamp) => Math.floor(timestamp.getHours() / 2);
        // Process likes
        matchLikes.forEach((like) => {
            const likeTimestamp = like.timestamp.toDate();
            const interval = getIntervalOfDay(likeTimestamp);
            likesPerInterval[interval]++;
        });
        // Process tickets
        matchTickets.forEach((ticket) => {
            const ticketTimestamp = ticket.timestamp.toDate();
            const interval = getIntervalOfDay(ticketTimestamp);
            ticketsPerInterval[interval]++;
        });
        // Process views
        matchViews.forEach((view) => {
            const viewTimestamp = view.timestamp.toDate();
            const interval = getIntervalOfDay(viewTimestamp);
            viewsPerInterval[interval]++;
            watchhoursPerInterval[interval] += view.watchhours;
        });
        matchadViews.forEach((view) => {
            const viewTimestamp = view.timestamp.toDate();
            const interval = getIntervalOfDay(viewTimestamp);
            adViewsPerInterval[interval]++;
            adWatchhoursPerInterval[interval] += view.watchhours;
        });
        // Process donations
        matchDonations.forEach((donation) => {
            const donationTimestamp = donation.timestamp.toDate();
            const interval = getIntervalOfDay(donationTimestamp);
            donationsPerInterval[interval]++;
            amountPerInterval[interval] += donation.amount;
        });
        // Generate data points for response
        const likesDatapoints = likesPerInterval.map((likes, interval) => ({
            hour: interval * 2,
            likes,
        }));
        const ticketsDatapoints = ticketsPerInterval.map((tickets, interval) => ({
            hour: interval * 2,
            tickets,
        }));
        const viewsDatapoints = viewsPerInterval.map((views, interval) => ({
            hour: interval * 2,
            views,
            watchhours: watchhoursPerInterval[interval],
        }));
        const adViewsDatapoints = adViewsPerInterval.map((views, interval) => ({
            hour: interval * 2,
            views,
            watchhours: adWatchhoursPerInterval[interval],
        }));
        const donationsDatapoints = donationsPerInterval.map((donations, interval) => ({
            hour: interval * 2,
            amount: amountPerInterval[interval],
        }));
        const dataPoints = {
            likesDatapoints,
            ticketsDatapoints,
            viewsDatapoints,
            adViewsDatapoints,
            donationsDatapoints,
            price,
            currency
        };
        response.status(200).json({ dataPoints });
    }
    catch (error) {
        console.error("Error retrieving match data:", error);
        response.status(500).send(`Error retrieving match data: ${error}`);
    }
});
exports.userData = functions.runWith({
    timeoutSeconds: 540
}).https.onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const docId = queryParams['docId'];
        const collection = queryParams['collection'];
        const subcollection = queryParams['subcollection'];
        const from = queryParams['from'];
        const to = queryParams['to'];
        if (!docId || !collection || !subcollection || !from || !to) {
            response.status(400).send('Missing query parameters: docId, collection, subcollection, from, and to are required.');
            return;
        }
        const fromDate = new Date(from);
        const toDate = new Date(to);
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            response.status(400).send('Invalid date format for from or to.');
            return;
        }
        const matchLikesSnapshot = await admin.firestore()
            .collection(collection)
            .doc(docId)
            .collection(subcollection)
            .get();
        const users = [];
        matchLikesSnapshot.forEach((doc) => {
            const data = doc.data();
            const likesList = data[subcollection];
            likesList.forEach((like) => {
                users.push({
                    userId: like.userId,
                    timestamp: like.timestamp
                });
            });
        });
        // Initialize structures for aggregation
        const daily = {};
        const weekly = {};
        const monthly = {};
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const currentYear = today.getFullYear();
        if (users.length > 0) {
            users.forEach(like => {
                const likeTimestamp = like.timestamp.toDate();
                const year = likeTimestamp.getFullYear();
                if (year === currentYear) {
                    const dateKey = likeTimestamp.toISOString().split('T')[0]; // Format the date as YYYY-MM-DD
                    // const hourKey = `${dateKey} ${String(likeTimestamp.getHours()).padStart(2, '0')}:00`; // Hourly key
                    // Process daily data
                    if (likeTimestamp >= fromDate && likeTimestamp <= toDate) {
                        if (dateKey === today.toISOString().split('T')[0]) {
                            if (!daily[dateKey])
                                daily[dateKey] = 0;
                            daily[dateKey]++; // Increment the like count for today
                        }
                    }
                    // Process weekly data
                    if (likeTimestamp >= startOfWeek && likeTimestamp <= today) {
                        const weekKey = getWeekKey(likeTimestamp); // Assuming getWeekKey is a function that generates the week key
                        if (!weekly[weekKey])
                            weekly[weekKey] = 0;
                        weekly[weekKey]++; // Increment the like count for this week
                    }
                    // Process monthly data
                    const monthKey = `${likeTimestamp.getFullYear()}-${String(likeTimestamp.getMonth() + 1).padStart(2, '0')}`;
                    if (!monthly[monthKey])
                        monthly[monthKey] = 0;
                    monthly[monthKey]++; // Increment the like count for this month
                }
            });
        }
        // Convert objects to arrays of maps with 'date:key' as key and followers count as value
        const convertToListOfMaps = (data) => {
            return Object.entries(data).map(([key, value]) => ({
                date: key,
                followers: value // value as the like count
            }));
        };
        const dailyList = convertToListOfMaps(daily);
        const weeklyList = convertToListOfMaps(weekly);
        const monthlyList = convertToListOfMaps(monthly);
        // Response structure
        response.status(200).json({
            followersDatapoints: {
                daily: dailyList,
                weekly: weeklyList,
                year: monthlyList,
            }
        });
    }
    catch (error) {
        console.error('Error retrieving user data:', error);
        response.status(500).send(`Error retrieving user data: ${error}`);
    }
});
// Helper function to get the week key for a given date
const getWeekKey = (date) => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay()); // Start of the week (Sunday)
    return startOfWeek.toISOString().split('T')[0]; // Return in 'YYYY-MM-DD' format
};
async function getExchangeRates() {
    try {
        const agoraapis = await db.collection("APIS").doc('api').get();
        const data = agoraapis.data();
        if (data) {
            const APIKEY = data.exchangeRateApi;
            const url = `https://v6.exchangerate-api.com/v6/${APIKEY}/latest/USD`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const apiData = await response.json();
            return apiData.conversion_rates;
        }
    }
    catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}
async function updateExchangeRates() {
    const exchangeRates = await getExchangeRates();
    if (exchangeRates) {
        const countryData = getCountryData();
        await db.collection('exchangeRates').doc('USD').set(Object.assign(Object.assign({}, exchangeRates), { timestamp: admin.firestore.Timestamp.now(), countryData: countryData }));
    }
}
const getCountryData = () => {
    return [
        { country: "United Arab Emirates", currency: "AED" },
        { country: "Afghanistan", currency: "AFN" },
        { country: "Albania", currency: "ALL" },
        { country: "Armenia", currency: "AMD" },
        { country: "Aruba", currency: "AWG" },
        { country: "Angola", currency: "AOA" },
        { country: "Argentina", currency: "ARS" },
        { country: "Australia", currency: "AUD" },
        { country: "Azerbaijan", currency: "AZN" },
        { country: "Bosnia and Herzegovina", currency: "BAM" },
        { country: "Barbados", currency: "BBD" },
        { country: "Bangladesh", currency: "BDT" },
        { country: "Bulgaria", currency: "BGN" },
        { country: "Bahrain", currency: "BHD" },
        { country: "Burundi", currency: "BIF" },
        { country: "Bermuda", currency: "BMD" },
        { country: "Brunei", currency: "BND" },
        { country: "Bolivia", currency: "BOB" },
        { country: "Brazil", currency: "BRL" },
        { country: "Bahamas", currency: "BSD" },
        { country: "Bhutan", currency: "BTN" },
        { country: "Botswana", currency: "BWP" },
        { country: "Belarus", currency: "BYN" },
        { country: "Belize", currency: "BZD" },
        { country: "Canada", currency: "CAD" },
        { country: "Democratic Republic of the Congo", currency: "CDF" },
        { country: "Switzerland", currency: "CHF" },
        { country: "Chile", currency: "CLP" },
        { country: "China", currency: "CNY" },
        { country: "Colombia", currency: "COP" },
        { country: "Costa Rica", currency: "CRC" },
        { country: "Cuba", currency: "CUP" },
        { country: "Cape Verde", currency: "CVE" },
        { country: "Czech Republic", currency: "CZK" },
        { country: "Djibouti", currency: "DJF" },
        { country: "Denmark", currency: "DKK" },
        { country: "Dominican Republic", currency: "DOP" },
        { country: "Algeria", currency: "DZD" },
        { country: "Egypt", currency: "EGP" },
        { country: "Eritrea", currency: "ERN" },
        { country: "Ethiopia", currency: "ETB" },
        { country: "Eurozone", currency: "EUR" },
        { country: "Fiji", currency: "FJD" },
        { country: "Falkland Islands", currency: "FKP" },
        { country: "Faroe Islands", currency: "FOK" },
        { country: "United Kingdom", currency: "GBP" },
        { country: "Georgia", currency: "GEL" },
        { country: "Guernsey", currency: "GGP" },
        { country: "Ghana", currency: "GHS" },
        { country: "Gibraltar", currency: "GIP" },
        { country: "Gambia", currency: "GMD" },
        { country: "Guinea", currency: "GNF" },
        { country: "Guatemala", currency: "GTQ" },
        { country: "Guyana", currency: "GYD" },
        { country: "Hong Kong", currency: "HKD" },
        { country: "Honduras", currency: "HNL" },
        { country: "Croatia", currency: "HRK" },
        { country: "Haiti", currency: "HTG" },
        { country: "Hungary", currency: "HUF" },
        { country: "Indonesia", currency: "IDR" },
        { country: "Israel", currency: "ILS" },
        { country: "Isle of Man", currency: "IMP" },
        { country: "India", currency: "INR" },
        { country: "Iraq", currency: "IQD" },
        { country: "Iran", currency: "IRR" },
        { country: "Iceland", currency: "ISK" },
        { country: "Jersey", currency: "JEP" },
        { country: "Jamaica", currency: "JMD" },
        { country: "Jordan", currency: "JOD" },
        { country: "Japan", currency: "JPY" },
        { country: "Kenya", currency: "KES" },
        { country: "Kyrgyzstan", currency: "KGS" },
        { country: "Cambodia", currency: "KHR" },
        { country: "Kiribati", currency: "KID" },
        { country: "Comoros", currency: "KMF" },
        { country: "South Korea", currency: "KRW" },
        { country: "Kuwait", currency: "KWD" },
        { country: "Cayman Islands", currency: "KYD" },
        { country: "Kazakhstan", currency: "KZT" },
        { country: "Laos", currency: "LAK" },
        { country: "Lebanon", currency: "LBP" },
        { country: "Sri Lanka", currency: "LKR" },
        { country: "Liberia", currency: "LRD" },
        { country: "Lesotho", currency: "LSL" },
        { country: "Libya", currency: "LYD" },
        { country: "Morocco", currency: "MAD" },
        { country: "Moldova", currency: "MDL" },
        { country: "Madagascar", currency: "MGA" },
        { country: "North Macedonia", currency: "MKD" },
        { country: "Myanmar", currency: "MMK" },
        { country: "Mongolia", currency: "MNT" },
        { country: "Macau", currency: "MOP" },
        { country: "Mauritania", currency: "MRU" },
        { country: "Mauritius", currency: "MUR" },
        { country: "Maldives", currency: "MVR" },
        { country: "Malawi", currency: "MWK" },
        { country: "Mexico", currency: "MXN" },
        { country: "Malaysia", currency: "MYR" },
        { country: "Mozambique", currency: "MZN" },
        { country: "Namibia", currency: "NAD" },
        { country: "Nigeria", currency: "NGN" },
        { country: "Nicaragua", currency: "NIO" },
        { country: "Norway", currency: "NOK" },
        { country: "Nepal", currency: "NPR" },
        { country: "New Zealand", currency: "NZD" },
        { country: "Oman", currency: "OMR" },
        { country: "Panama", currency: "PAB" },
        { country: "Peru", currency: "PEN" },
        { country: "Papua New Guinea", currency: "PGK" },
        { country: "Philippines", currency: "PHP" },
        { country: "Pakistan", currency: "PKR" },
        { country: "Poland", currency: "PLN" },
        { country: "Paraguay", currency: "PYG" },
        { country: "Qatar", currency: "QAR" },
        { country: "Romania", currency: "RON" },
        { country: "Serbia", currency: "RSD" },
        { country: "Russia", currency: "RUB" },
        { country: "Rwanda", currency: "RWF" },
        { country: "Saudi Arabia", currency: "SAR" },
        { country: "Solomon Islands", currency: "SBD" },
        { country: "Seychelles", currency: "SCR" },
        { country: "Sudan", currency: "SDG" },
        { country: "Sweden", currency: "SEK" },
        { country: "Singapore", currency: "SGD" },
        { country: "Saint Helena", currency: "SHP" },
        { country: "Sierra Leone", currency: "SLL" },
        { country: "Somalia", currency: "SOS" },
        { country: "Suriname", currency: "SRD" },
        { country: "South Sudan", currency: "SSP" },
        { country: "São Tomé and Príncipe", currency: "STN" },
        { country: "Syria", currency: "SYP" },
        { country: "Eswatini", currency: "SZL" },
        { country: "Thailand", currency: "THB" },
        { country: "Tajikistan", currency: "TJS" },
        { country: "Turkmenistan", currency: "TMT" },
        { country: "Tunisia", currency: "TND" },
        { country: "Tonga", currency: "TOP" },
        { country: "Turkey", currency: "TRY" },
        { country: "Trinidad and Tobago", currency: "TTD" },
        { country: "Tuvalu", currency: "TVD" },
        { country: "Taiwan", currency: "TWD" },
        { country: "Tanzania", currency: "TZS" },
        { country: "Ukraine", currency: "UAH" },
        { country: "Uganda", currency: "UGX" },
        { country: "United States", currency: "USD" },
        { country: "Uruguay", currency: "UYU" },
        { country: "Uzbekistan", currency: "UZS" },
        { country: "Venezuela", currency: "VES" },
        { country: "Vietnam", currency: "VND" },
        { country: "Vanuatu", currency: "VUV" },
        { country: "Samoa", currency: "WST" },
        { country: "Central African Republic", currency: "XAF" },
        { country: "East Caribbean", currency: "XCD" },
        { country: "International Monetary Fund", currency: "XDR" },
        { country: "West African States", currency: "XOF" },
        { country: "French Polynesia", currency: "XPF" },
        { country: "Yemen", currency: "YER" },
        { country: "South Africa", currency: "ZAR" },
        { country: "Zambia", currency: "ZMW" },
        { country: "Zimbabwe", currency: "ZWL" }
    ];
};
exports.scheduledUpdateExchangeRates = functions.pubsub.schedule('every 2 hours').onRun(async (context) => {
    await updateExchangeRates();
    await runIfFirstOfMonth();
    console.log('Exchange rates updated successfully.');
});
exports.scheduledUpdateMM = functions.pubsub.schedule('every 12 hours').onRun(async (context) => {
    await runIfFirstOfMonth();
    console.log('Exchange rates updated successfully.');
});
exports.scheduledUpdatePM = functions.pubsub.schedule('every 72 hours').onRun(async (context) => {
    await reminderUser();
});
async function reminderUser() {
    const now = new Date();
    let day = now.getDate();
    const endDate = new Date(now.getFullYear(), now.getMonth(), day + 2);
    console.log(`Fetching users with plans expiring between ${now} and ${endDate}`);
    let allUsers = [];
    try {
        // Fetching users from Clubs collection
        const querySnapshot = await admin.firestore().collection("Clubs")
            .where("planETime", "<=", endDate)
            .where("planETime", ">", now)
            .get();
        const users = await Promise.all(querySnapshot.docs.map(async (doc) => {
            const data = doc.data();
            return {
                email: data === null || data === void 0 ? void 0 : data.email,
                token: data === null || data === void 0 ? void 0 : data.token,
                plan: data === null || data === void 0 ? void 0 : data.plan,
                collection: "Club",
                username: data === null || data === void 0 ? void 0 : data.Clubname,
            };
        }));
        allUsers.push(...users);
        console.log(`Fetched ${users.length} users from Clubs.`);
    }
    catch (error) {
        console.error("Error fetching users from Clubs collection:", error);
    }
    try {
        // Fetching users from Professionals collection
        const querySnapshot1 = await admin.firestore().collection("Professionals")
            .where("planETime", "<=", endDate)
            .where("planETime", ">", now)
            .get();
        const users1 = await Promise.all(querySnapshot1.docs.map(async (doc) => {
            const data = doc.data();
            return {
                email: data === null || data === void 0 ? void 0 : data.email,
                token: data === null || data === void 0 ? void 0 : data.token,
                plan: data === null || data === void 0 ? void 0 : data.plan,
                collection: "Professional",
                username: data === null || data === void 0 ? void 0 : data.Stagename,
            };
        }));
        allUsers.push(...users1);
        console.log(`Fetched ${users1.length} users from Professionals.`);
    }
    catch (error) {
        console.error("Error fetching users from Professionals collection:", error);
    }
    // Log total users
    console.log(`Total users to process: ${allUsers.length}`);
    if (allUsers.length !== 0) {
        for (const user of allUsers) {
            const { email, username, token, collection, plan } = user;
            let planDetails = "";
            switch (plan) {
                case "plan1HDM":
                    planDetails = "1 vs 1 Monthly plan";
                    break;
                case "plan1HDW":
                    planDetails = "1 vs 1 Weekly plan";
                    break;
                case "plan2HDW":
                    planDetails = "Standard Weekly plan";
                    break;
                case "plan2HDM":
                    planDetails = "Standard Monthly plan";
                    break;
                case "planproW":
                    planDetails = "Pro Weekly plan";
                    break;
                case "planproM":
                    planDetails = "Pro Monthly plan";
                    break;
                default:
                    planDetails = "Unknown plan";
                    break;
            }
            // Send notification if token is available
            if (token) {
                const message = {
                    notification: {
                        title: "Reminder",
                        body: `Hello ${username}, your ${planDetails} expires in 2 days`,
                    },
                    data: {
                        click_action: "FLUTTER_NOTIFICATION_CLICK",
                        tab: "/PLANS",
                        d: "",
                    },
                    android: {
                        notification: {
                            sound: "default",
                            image: "",
                        },
                    },
                    token,
                };
                try {
                    console.log(`Sending notification to ${username}`);
                    await sendANotification(message);
                    console.log(`Notification sent successfully to ${username}`);
                }
                catch (error) {
                    console.error(`Failed to send notification to ${username}:`, error);
                }
            }
            // Send email if email is available
            if (email) {
                try {
                    console.log(`Sending email reminder to ${email}`);
                    await sendEmailReminder(email, username, collection, planDetails);
                    console.log(`Email sent successfully to ${email}`);
                }
                catch (error) {
                    console.error(`Failed to send email to ${email}:`, error);
                }
            }
            else {
                console.warn(`No email available for user: ${username}`);
            }
        }
    }
    else {
        console.log("No users found with expiring plans.");
    }
}
const sendEmailReminder = async (usermail, username, collection, planDetails) => {
    const url = "https://api.mailersend.com/v1/email";
    const agoraapis = await admin.firestore().collection("APIS").doc("api").get();
    const data = agoraapis.data();
    let token = ""; // Replace with your actual MailerSend API token
    if (data != undefined) {
        token = data.emailApi;
    }
    // Map account type to role-specific functionalities
    const roleDescriptions = {
        Fan: `As a <strong>Fan</strong>, you are the heartbeat of the arena! Renew your plan to:
      <ul style='text-align: left;'>
        <li>Watch live matches from your favorite local teams.</li>
        <li>Like, comment, and share your thoughts on exciting moments.</li>
        <li>Post videos and images to celebrate your favorite teams and players.</li>
        <li>No more rumors—be there by watching events unfold live.</li>
      </ul>`,
        Club: `As a <strong>Club</strong>, renewing your plan allows you to:
      <ul style='text-align: left;'>
        <li>Create and manage a team of players.</li>
        <li>Organize and broadcast matches live for your fans.</li>
        <li>Engage with your audience and grow your club's presence.</li>
      </ul>`,
        Professional: `As a <strong>Professional</strong>, keep enjoying these benefits by renewing your plan:
      <ul style='text-align: left;'>
        <li>Create and manage leagues, inviting teams to participate.</li>
        <li>Organize matches for league members and broadcast them live.</li>
        <li>Set up contests and create unforgettable moments for players and fans alike.</li>
        <li>Be part of a team as a player of a club.</li>
      </ul>`
    };
    const roleDescription = roleDescriptions[collection];
    const payload = {
        from: {
            email: "info@fansarenakenya.site", // Replace with your sender email
        },
        to: [
            {
                email: usermail, // Replace with the recipient email
            },
        ],
        subject: `Hello, ${username}! Your Plan Ends in 2 Days!`,
        text: `Hi ${username}, your ${planDetails} expires in two days!`,
        html: `
      <div style="font-family: Arial, sans-serif; text-align: center;">
        <img src="https://firebasestorage.googleapis.com/v0/b/fans-arena.appspot.com/o/Posts%2Fimages%2F1721637929628.jpg?alt=media&token=2bb7c202-6c8f-495e-af3f-585e32b2b261" alt="Fans Arena Logo" style="width: 150px; margin-bottom: 20px;" />
        <h1 style="font-size: 24px; color: #333;">
          <span style="color: yellow;">F</span>ans
          <span style="color: orange;">A</span>rena
        </h1>
        <p style="font-size: 16px; color: #555;">
          Hi ${username}, just a quick reminder that your plan will expire in two days.
        </p>
        <p style="font-size: 16px; color: #555;">
         Plan: ${planDetails}
        </p>
        <p style="font-size: 16px; color: #555;">
          ${roleDescription}
        </p>
        <p style="font-size: 14px; color: #777; margin-top: 20px;">
          Renew today to ensure uninterrupted access to your favorite features.<br />
          <a href="https://fansarenakenya.site/" style="color: #007bff; text-decoration: none;">Renew Now</a>
        </p>
        <p style="font-size: 14px; color: #777; margin-top: 20px;">
          Regards,<br />
          Fans Arena Team
        </p>
      </div>
    `,
    };
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const error = await response.json();
            console.error("Error sending email:", error);
            throw new Error(`Failed to send email: ${response.statusText}`);
        }
        const result = await response.json();
        console.log("Email sent successfully:", result);
    }
    catch (error) {
        console.error("Error occurred:", error);
    }
};
async function runIfFirstOfMonth() {
    const today = new Date();
    if (today.getDate() !== 1) {
        console.log("Today is not the first of the month. Exiting.");
        return;
    }
    const monthAsNumber = 0;
    const monthOffset = monthAsNumber !== null && monthAsNumber !== void 0 ? monthAsNumber : 0;
    const now = new Date();
    let m = now.getMonth() - 1;
    let y = 0;
    if (m - monthOffset < 0) {
        y = 1;
        m = 12 + (m - monthOffset);
    }
    else {
        m = m - monthOffset;
    }
    const startOfMonth = new Date(now.getFullYear() - y, m, 1);
    const endOfMonth = new Date(now.getFullYear() - y, m + 1, 0);
    const snapshots = await admin.firestore().collection("Monetisation").get();
    for (const doc of snapshots.docs) {
        const authorId = doc.id;
        const usersCollection = doc.data().collection;
        const matchDataList = [];
        let totalAmount = 0;
        for (const collection of ["Matches", "Events"]) {
            const matchesSnapshot = await admin.firestore()
                .collection(collection)
                .where("authorId", "==", authorId)
                .where("stoptime", ">=", startOfMonth)
                .where("stoptime", "<=", endOfMonth)
                .get();
            for (const matchDoc of matchesSnapshot.docs) {
                const matchId = matchDoc.id;
                const matchData = matchDoc.data();
                const starttime = matchData.starttime.toDate();
                const stoptime = matchData.stoptime.toDate();
                const scheduledDate = matchData.scheduledDate;
                const totalMinutes = Math.ceil((stoptime.getTime() - starttime.getTime()) / 1000 / 60);
                let totalLikes = 0;
                let totalViews = 0;
                let totalWatchhours = 0;
                let totaladViews = 0;
                let totaladWatchhours = 0;
                let totalDonations = 0;
                let amount = 0;
                let totalTickets = 0;
                const matchLikesSnapshot = await admin.firestore()
                    .collection(collection)
                    .doc(matchId)
                    .collection("likes")
                    .get();
                const matchViewsSnapshot = await admin.firestore()
                    .collection(collection)
                    .doc(matchId)
                    .collection("views")
                    .get();
                const matchadViewsSnapshot = await admin.firestore()
                    .collection(collection)
                    .doc(matchId)
                    .collection("adViews")
                    .get();
                const matchDonationsSnapshot = await admin.firestore()
                    .collection(collection)
                    .doc(matchId)
                    .collection("donations")
                    .get();
                const matchTicketsSnapshot = await admin.firestore()
                    .collection(collection)
                    .doc(matchId)
                    .collection("tickets")
                    .get();
                matchLikesSnapshot.forEach((doc) => {
                    const likesList = doc.data().likes || [];
                    totalLikes += likesList.length;
                });
                matchViewsSnapshot.forEach((doc) => {
                    const viewsList = doc.data().views || [];
                    totalViews += viewsList.length;
                    totalWatchhours += viewsList.reduce((sum, view) => sum + (view.watchhours || 0), 0);
                });
                matchadViewsSnapshot.forEach((doc) => {
                    const viewsList = doc.data().views || [];
                    totaladViews += viewsList.length;
                    totaladWatchhours += viewsList.reduce((sum, view) => sum + (view.watchhours || 0), 0);
                });
                matchDonationsSnapshot.forEach((doc) => {
                    const donationList = doc.data().donations || [];
                    totalDonations += donationList.length;
                    amount += donationList.reduce((sum, donation) => sum + (donation.amount || 0), 0);
                });
                matchTicketsSnapshot.forEach((doc) => {
                    const ticketsList = doc.data().tickets || [];
                    totalTickets += ticketsList.length;
                });
                const day = starttime.getDate();
                totalAmount += amount;
                const matchDataPoint = {
                    date: starttime.toISOString().split("T")[0],
                    starttime: matchData.starttime,
                    stoptime: matchData.stoptime,
                    scheduledDate: scheduledDate,
                    matchId: matchId,
                    day: day,
                    totalLikes: totalLikes,
                    duration: totalMinutes,
                    totalWatchhours: totalWatchhours,
                    totalViews: totalViews,
                    totaladWatchhours: totaladWatchhours,
                    totaladViews: totaladViews,
                    donations: totalDonations,
                    amount: amount,
                    tickets: totalTickets,
                    price: matchData.price,
                    currency: matchData.currency,
                };
                matchDataList.push(matchDataPoint);
            }
        }
        const id = generateRandomUid(28);
        await admin.firestore()
            .collection(usersCollection)
            .doc(authorId)
            .collection("Monetisation")
            .doc(id)
            .set({ matchDataList: matchDataList, amount: totalAmount, timestamp: new Date() });
    }
}
exports.allMatchData = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (request, response) => {
    var _a;
    try {
        const queryParams = convertParsedQs(request.query);
        const authorId = queryParams['docId'];
        const collection = queryParams['collection'];
        const monthString = queryParams['month'];
        const monthAsNumber = monthString && !isNaN(parseInt(monthString, 10)) ? parseInt(monthString, 10) : undefined;
        if (!authorId || !collection) {
            response.status(400).send('Missing query parameters: authorId and collection are required.');
            return;
        }
        const now = new Date();
        const monthOffset = monthAsNumber !== null && monthAsNumber !== void 0 ? monthAsNumber : 0;
        let m = now.getMonth();
        let y = 0;
        if (m - monthOffset < 0) {
            y = 1;
            m = 12 + (m - monthOffset);
        }
        else {
            m = m - monthOffset;
        }
        const startOfMonth = new Date(now.getFullYear() - y, m, 1);
        const endOfMonth = new Date(now.getFullYear() - y, m + 1, 0);
        const matchesSnapshot = await admin.firestore()
            .collection(collection)
            .where('authorId', '==', authorId)
            .where('stoptime', '>=', startOfMonth)
            .where('stoptime', '<=', endOfMonth)
            .get();
        const matchDataList = [];
        for (const matchDoc of matchesSnapshot.docs) {
            const matchId = matchDoc.id;
            const matchData = matchDoc.data();
            const starttime = matchData.starttime.toDate();
            const stoptime = matchData.stoptime.toDate();
            const scheduledDate = matchData.scheduledDate;
            const totalMinutes = Math.ceil((stoptime.getTime() - starttime.getTime()) / 1000 / 60);
            let totalLikes = 0;
            let totalViews = 0;
            let totalWatchhours = 0;
            let totaladViews = 0;
            let totaladWatchhours = 0;
            let totalDonations = 0;
            let amount = 0;
            let totalTickets = 0;
            const matchLikesSnapshot = await admin.firestore()
                .collection(collection)
                .doc(matchId)
                .collection('likes')
                .get();
            const matchViewsSnapshot = await admin.firestore()
                .collection(collection)
                .doc(matchId)
                .collection('views')
                .get();
            const matchadViewsSnapshot = await admin.firestore()
                .collection(collection)
                .doc(matchId)
                .collection('adViews')
                .get();
            const matchDonationsSnapshot = await admin.firestore()
                .collection(collection)
                .doc(matchId)
                .collection('donations')
                .get();
            const matchTicketsSnapshot = await admin.firestore()
                .collection(collection)
                .doc(matchId)
                .collection('tickets')
                .get();
            matchLikesSnapshot.forEach((doc) => {
                const likesList = doc.data().likes || [];
                totalLikes += likesList.length;
            });
            matchViewsSnapshot.forEach((doc) => {
                const viewsList = doc.data().views || [];
                totalViews += viewsList.length;
                totalWatchhours += viewsList.reduce((sum, view) => sum + view.watchhours, 0);
            });
            matchadViewsSnapshot.forEach((doc) => {
                const viewsList = doc.data().views || [];
                totaladViews += viewsList.length;
                totaladWatchhours += viewsList.reduce((sum, view) => sum + view.watchhours, 0);
            });
            matchDonationsSnapshot.forEach((doc) => {
                const donationList = doc.data().donations || [];
                totalDonations += donationList.length;
                amount += donationList.reduce((sum, donation) => sum + (donation.amount || 0), 0);
            });
            matchTicketsSnapshot.forEach((doc) => {
                const ticketsList = doc.data().tickets || [];
                totalTickets += ticketsList.length;
            });
            const day = starttime.getDate();
            const matchDataPoint = {
                date: starttime.toISOString().split('T')[0],
                starttime: matchData.starttime,
                stoptime: matchData.stoptime,
                scheduledDate: scheduledDate,
                matchId: matchId,
                day: day,
                totalLikes: totalLikes,
                duration: totalMinutes,
                totalWatchhours: totalWatchhours,
                totalViews: totalViews,
                totaladWatchhours: totaladWatchhours,
                totaladViews: totaladViews,
                donations: totalDonations,
                amount: amount,
                tickets: totalTickets,
                price: (_a = matchData.price) !== null && _a !== void 0 ? _a : 0,
                currency: matchData.currency,
            };
            matchDataList.push(matchDataPoint);
        }
        response.status(200).json({ matchDataPoints: matchDataList });
    }
    catch (error) {
        console.error('Error retrieving match data:', error);
        response.status(500).send(`Error retrieving match data: ${error}`);
    }
});
exports.handleTransaction = functions.runWith({
    timeoutSeconds: 540,
}).https.onRequest(async (req, res) => {
    try {
        const { email, reference, amount, currency, userId } = req.query;
        // Validate required query parameters
        if (!email || !reference || !amount || !userId) {
            console.error("Missing required query parameters:", { email, reference, amount, userId });
            res.status(400).send("Missing required query parameters: email, reference, amount, or userId.");
            return;
        }
        let referenceList;
        try {
            referenceList = reference;
            if (!Array.isArray(referenceList) || referenceList.length === 0) {
                throw new Error("Reference parameter must be a non-empty array.");
            }
        }
        catch (e) {
            console.error("Invalid reference parameter:", reference);
            res.status(400).send("Invalid reference parameter. Must be a JSON array of strings.");
            return;
        }
        // "textPayload": "Invalid reference parameter: [ 'TICKET', '81d2efe1-36c2-4164-9438-119faf3c525e' ]",
        const transactionId = generateRandomUid(28);
        // Store transaction in Firestore
        const transactionPayload = {
            transactionId,
            email,
            reference: referenceList,
            amount,
            currency: currency || "USD",
            transaction: req.body,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        };
        console.log("Storing transaction:", transactionPayload);
        await db.collection("Transactions").doc(transactionId).set(transactionPayload);
        if (userId) {
            const firstReference = referenceList[0];
            const ref = firstReference.startsWith("A") ? `an ${firstReference}` : `a ${firstReference}`;
            const purchaseDetails = {
                plan1HDM: "the 1 vs 1 Monthly plan",
                plan1HDW: "the 1 vs 1 Weekly plan",
                plan2HDW: "the Standard Weekly plan",
                plan2HDM: "the Standard Monthly plan",
                planproW: "the Pro Weekly plan",
                planproM: "the Pro Monthly plan",
            }[firstReference] || `${ref}`;
            const userData = await fetchUserData(userId);
            if (userData) {
                const { token, email: userEmail, username, collectionName } = userData;
                // Send push notification
                if (token) {
                    const message = {
                        notification: {
                            title: "New Purchase",
                            body: `Purchased ${purchaseDetails}`,
                        },
                        data: {
                            click_action: "FLUTTER_NOTIFICATION_CLICK",
                            tab: "/PURCHASE",
                        },
                        android: {
                            notification: {
                                sound: "default",
                            },
                        },
                        token,
                    };
                    console.log("Sending notification:", message);
                    await sendANotification(message);
                }
                // Send email notification
                console.log("Sending email to:", userEmail);
                await sendEmail2(userEmail, username, collectionName, purchaseDetails, amount, currency);
            }
            else {
                console.warn("User data not found for userId:", userId);
            }
        }
        res.status(200).json("Transaction successfully recorded.");
    }
    catch (error) {
        console.error("Error handling transaction:", { error, query: req.query, body: req.body });
        res.status(500).send("An error occurred while processing the transaction.");
    }
});
exports.updatePlan = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed. Only POST requests are accepted.");
        return;
    }
    try {
        // Retrieve transaction data from request body
        const data = req.body;
        if (!data.collection || !data.userId || !data.plan) {
            res.status(400).send("Invalid request. Missing required fields: 'collection', 'userId', or 'plan'.");
            return;
        }
        // Current date
        const now = new Date();
        // Determine plan duration
        let planETime;
        if (data.plan.endsWith("M")) {
            // Add one month
            const afterMonth = new Date(now);
            afterMonth.setMonth(afterMonth.getMonth() + 1);
            planETime = admin.firestore.Timestamp.fromDate(afterMonth);
        }
        else if (data.plan.endsWith("W")) {
            // Add one week (7 days)
            const afterWeek = new Date(now);
            afterWeek.setDate(afterWeek.getDate() + 7);
            planETime = admin.firestore.Timestamp.fromDate(afterWeek);
        }
        else {
            res.status(400).send("Invalid plan format. Plan should end with 'M' or 'W'.");
            return;
        }
        // Update the user's plan in Firestore
        await db.collection(data.collection).doc(data.userId).update({
            plan: data.plan,
            planETime: planETime,
        });
        // await db.collection("Payments").doc(data.userId).update({
        //  plan: data.plan,
        // planETime: planETime,
        //});
        res.status(200).json("Plan successfully updated.");
    }
    catch (error) {
        console.error("Error handling data:", error);
        res.status(500).send("An error occurred while processing the data.");
    }
});
exports.updateLocation = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (req, response) => {
    const data = req.body;
    try {
        // Save the transaction result to Firestore
        //const geoPoint = new admin.firestore.GeoPoint(data.location.latitude, data.location.longitude);
        //await db.collection(data.collection).doc(data.userId).update({location:geoPoint,});
        await sendAllNotification(data.tokens, data.message, data.topic);
        response.status(200).json(200);
    }
    catch (error) {
        console.error('Error retrieving match data:', error);
        response.status(500).send(`Error retrieving match data: ${error}`);
    }
});
exports.updateLocation1 = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (req, response) => {
    const data = req.body;
    try {
        // Save the transaction result to Firestore
        const geoPoint = new admin.firestore.GeoPoint(data.location.latitude, data.location.longitude);
        await db.collection(data.collection).doc(data.userId).update({ location: geoPoint, });
        response.status(200).json(200);
    }
    catch (error) {
        console.error('Error retrieving match data:', error);
        response.status(500).send(`Error retrieving match data: ${error}`);
    }
});
exports.postData = functions.runWith({
    timeoutSeconds: 540
}).https.onRequest(async (request, response) => {
    try {
        const queryParams = convertParsedQs(request.query);
        const docId = queryParams['docId'];
        const collection = queryParams['collection'];
        if (!docId || !collection) {
            response.status(400).send('Missing query parameters: docId and collection are required.');
            return;
        }
        const currentYear = new Date().getFullYear();
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Start of the current week
        // Retrieve match document
        const matchDoc = await admin.firestore()
            .collection(collection)
            .doc(docId)
            .get();
        if (!matchDoc.exists) {
            response.status(404).send('Match document not found');
            return;
        }
        const matchData = matchDoc.data();
        if (!matchData) {
            response.status(404).send('No match data found');
            return;
        }
        // Fetch likes and views
        const matchLikesSnapshot = await admin.firestore()
            .collection(collection)
            .doc(docId)
            .collection('likes')
            .get();
        const matchViewsSnapshot = await admin.firestore()
            .collection(collection)
            .doc(docId)
            .collection('views')
            .get();
        const matchLikes = [];
        matchLikesSnapshot.forEach((doc) => {
            const likesList = doc.data().likes || [];
            likesList.forEach((like) => {
                matchLikes.push({
                    userId: like.userId,
                    timestamp: like.timestamp
                });
            });
        });
        const matchViews = [];
        matchViewsSnapshot.forEach((doc) => {
            const viewsList = doc.data().views || [];
            viewsList.forEach((view) => {
                matchViews.push({
                    userId: view.userId,
                    timestamp: view.timestamp,
                    watchhours: view.watchhours
                });
            });
        });
        const daily = [];
        const weekly = [];
        const year = [];
        const getHourKey = (date) => {
            const hourKey = `${date} ${String(date.getHours()).padStart(2, '0')}:00`; // Format hour in 'HH:00'
            return hourKey;
        };
        const getWeekKey = (date) => {
            const startOfWeek = new Date(date);
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            return startOfWeek.toISOString().split('T')[0];
        };
        const getMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        // Process Likes
        if (matchLikes.length > 0) {
            matchLikes.forEach(like => {
                const likeTimestamp = like.timestamp.toDate();
                if (likeTimestamp.getFullYear() !== currentYear)
                    return; // Skip if not current year
                const dayKey = getHourKey(likeTimestamp);
                const weekKey = getWeekKey(likeTimestamp);
                const monthKey = getMonthKey(likeTimestamp);
                // Only process if the like is from today or the current week
                if (getHourKey(today) === dayKey) {
                    let dayRecord = daily.find(item => item.date === dayKey);
                    if (!dayRecord) {
                        dayRecord = { date: dayKey, likes: 0, views: 0, watchhours: 0 };
                        daily.push(dayRecord);
                    }
                    dayRecord.likes++;
                }
                if (getWeekKey(today) === weekKey) {
                    let weekRecord = weekly.find(item => item.date === weekKey);
                    if (!weekRecord) {
                        weekRecord = { date: weekKey, likes: 0, views: 0, watchhours: 0 };
                        weekly.push(weekRecord);
                    }
                    weekRecord.likes++;
                }
                let yearRecord = year.find(item => item.date === monthKey);
                if (!yearRecord) {
                    yearRecord = { date: monthKey, likes: 0, views: 0, watchhours: 0 };
                    year.push(yearRecord);
                }
                yearRecord.likes++;
            });
        }
        // Process Views
        if (matchViews.length > 0) {
            matchViews.forEach(view => {
                const viewTimestamp = view.timestamp.toDate();
                if (viewTimestamp.getFullYear() !== currentYear)
                    return; // Skip if not current year
                const watchhour = view.watchhours;
                const dayKey = getHourKey(viewTimestamp);
                const weekKey = getWeekKey(viewTimestamp);
                const monthKey = getMonthKey(viewTimestamp);
                // Only process if the view is from today or the current week
                if (getHourKey(today) === dayKey) {
                    let dayRecord = daily.find(item => item.date === dayKey);
                    if (!dayRecord) {
                        dayRecord = { date: dayKey, likes: 0, views: 0, watchhours: 0 };
                        daily.push(dayRecord);
                    }
                    dayRecord.views++;
                    dayRecord.watchhours += watchhour;
                }
                if (getWeekKey(today) === weekKey) {
                    let weekRecord = weekly.find(item => item.date === weekKey);
                    if (!weekRecord) {
                        weekRecord = { date: weekKey, likes: 0, views: 0, watchhours: 0 };
                        weekly.push(weekRecord);
                    }
                    weekRecord.views++;
                    weekRecord.watchhours += watchhour;
                }
                let yearRecord = year.find(item => item.date === monthKey);
                if (!yearRecord) {
                    yearRecord = { date: monthKey, likes: 0, views: 0, watchhours: 0 };
                    year.push(yearRecord);
                }
                yearRecord.views++;
                yearRecord.watchhours += watchhour;
            });
        }
        response.status(200).json({
            dataPoints: {
                daily,
                weekly,
                year
            }
        });
    }
    catch (error) {
        console.error('Error retrieving match data:', error);
        response.status(500).send(`Error retrieving match data: ${error}`);
    }
});
exports.handleTransaction1 = functions.runWith({
    timeoutSeconds: 540 // Adjust the timeout value as needed
}).https.onRequest(async (req, res) => {
    try {
        if (req.method !== "POST") {
            res.status(405).send("Method Not Allowed. Only POST requests are accepted.");
            return;
        }
        const Id = generateRandomUid(28);
        // Save the transaction result to Firestore
        await db.collection('Transactions1').doc(Id).set({
            transactionId: Id,
            data: req.body.data,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        res.status(200).json({ status: 'success', transactionId: Id });
    }
    catch (error) {
        console.error('Error handling donation transaction:', error);
        res.status(500).send(`Error handling donation transaction: ${error}`);
    }
});
async function convertToUSD(amount, country) {
    // Fetch exchange rates from Firestore
    const exchangeRatesDoc = await admin.firestore().collection('exchangeRates').doc('USD').get();
    const exchangeRates = exchangeRatesDoc.data();
    const countryData = (exchangeRates === null || exchangeRates === void 0 ? void 0 : exchangeRates.countryData) || [];
    if (!exchangeRates) {
        throw new Error('Exchange rates not found');
    }
    // Find the currency for the given country
    const countryInfo = countryData.find((d) => d.country === country);
    if (!countryInfo) {
        throw new Error(`Currency for country ${country} not found`);
    }
    const currency = countryInfo.currency;
    const rate = exchangeRates[currency];
    if (!rate) {
        throw new Error(`Exchange rate for ${currency} not found`);
    }
    // Convert the amount to USD
    const amountInUSD = amount / rate;
    return amountInUSD;
}
// Example usage
convertToUSD(100, 'Kenya').then(amountInUSD => {
    console.log('Amount in USD:', amountInUSD);
}).catch(error => {
    console.error('Error:', error);
});
async function fetchCurrentAddress(latitude, longitude) {
    var _a, _b;
    console.log("Fetching API key from Firestore...");
    const doc = await admin.firestore().collection("APIS").doc("api").get();
    const mapsApi = (_a = doc.data()) === null || _a === void 0 ? void 0 : _a.mapsApi;
    if (!mapsApi) {
        console.error("Maps API key not found in Firestore document.");
        return {
            addressDetails: ["Error: Maps API key not found"],
            country: "Unknown",
            states: [],
            cities: [],
            nearbyPlaces: ["Error: Maps API key not found"],
        };
    }
    console.log("Maps API key retrieved successfully.");
    try {
        console.log(`Fetching geocode data for coordinates: (${latitude}, ${longitude})`);
        const geocodeApiUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${mapsApi}`;
        const geocodeResponse = await axios_1.default.get(geocodeApiUrl);
        console.log("Geocode API response status:", geocodeResponse.status);
        if (geocodeResponse.status === 200) {
            const data = geocodeResponse.data;
            console.log("Geocode API response data:", data);
            if (data.results && data.results.length > 0) {
                console.log("Parsing address components...");
                const addressComponents = data.results[0].address_components;
                const addressDetails = addressComponents.map((component) => component.long_name);
                console.log("Address components parsed:", addressDetails);
                const country = ((_b = addressComponents.find((component) => component.types.includes("country"))) === null || _b === void 0 ? void 0 : _b.long_name) || "Unknown";
                const states = addressComponents
                    .filter((component) => component.types.some((type) => ["administrative_area_level_1", "administrative_area_level_2"].includes(type)))
                    .map((component) => component.long_name);
                const cities = addressComponents
                    .filter((component) => component.types.includes("locality"))
                    .map((component) => component.long_name);
                console.log("Country:", country);
                console.log("States:", states);
                console.log("Cities:", cities);
                console.log("Fetching nearby places...");
                const placesApiUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`;
                const placesResponse = await axios_1.default.get(`${placesApiUrl}?location=${latitude},${longitude}&radius=2000&key=${mapsApi}`);
                console.log("Places API response status:", placesResponse.status);
                let nearbyPlaces = [];
                if (placesResponse.status === 200) {
                    const placesData = placesResponse.data;
                    console.log("Places API response data:", placesData);
                    if (placesData.results && placesData.results.length > 0) {
                        nearbyPlaces = placesData.results.map((place) => place.name);
                    }
                    else {
                        nearbyPlaces.push("No nearby places found");
                    }
                }
                else {
                    console.error("Places API returned an error:", placesResponse.status);
                    nearbyPlaces.push(`Error: ${placesResponse.status}`);
                }
                console.log("Nearby places:", nearbyPlaces);
                return {
                    addressDetails,
                    country,
                    states,
                    cities,
                    nearbyPlaces,
                };
            }
            else {
                console.warn("No address found in geocode data.");
                return {
                    addressDetails: ["No address found"],
                    country: "Unknown",
                    states: [],
                    cities: [],
                    nearbyPlaces: ["No nearby places found"],
                };
            }
        }
        else {
            console.error("Failed to fetch address, status code:", geocodeResponse.status);
            throw new Error("Failed to fetch address");
        }
    }
    catch (error) {
        console.error("Error during address fetch:", error.message);
        return {
            addressDetails: ["Error: " + error.message],
            country: "Unknown",
            states: [],
            cities: [],
            nearbyPlaces: ["Error: " + error.message],
        };
    }
}
exports.getPlaces = functions
    .runWith({ timeoutSeconds: 540 }) // Adjust the timeout as needed
    .https.onRequest(async (req, res) => {
    try {
        if (req.method !== "POST") {
            res.status(405).send("Method Not Allowed. Only POST requests are accepted.");
            return;
        }
        const data = req.body;
        const lat = parseFloat(data.lat);
        const long = parseFloat(data.long);
        if (isNaN(lat) || isNaN(long)) {
            res.status(400).send("Invalid latitude or longitude values.");
            return;
        }
        const distanceKm = 1;
        // Calculate bounding box
        const latOffset = distanceKm / 111; // 1 degree latitude = 111 km
        const lonOffset = distanceKm / (111 * Math.cos(lat * (Math.PI / 180)));
        const minLat = Math.max(lat - latOffset, -90);
        const maxLat = Math.min(lat + latOffset, 90);
        const minLong = Math.max(long - lonOffset, -180);
        const maxLong = Math.min(long + lonOffset, 180);
        // Firebase query
        const querySnapshot = await admin
            .firestore()
            .collection("places")
            .where("lat", ">=", minLat)
            .where("lat", "<=", maxLat)
            .where("long", ">=", minLong)
            .where("long", "<=", maxLong)
            .get();
        if (querySnapshot.docs.length > 0) {
            const places = querySnapshot.docs.map((doc) => doc.data());
            res.status(200).json({ places: places });
        }
        else {
            let addressData;
            try {
                addressData = await fetchCurrentAddress(lat, long);
            }
            catch (fetchError) {
                console.error("Error fetching address from Google:", fetchError);
                res.status(500).send("Error fetching address from Google.");
                return;
            }
            try {
                const Id = generateRandomUid(28);
                await admin.firestore().collection("places").doc(Id).set({
                    lat: lat,
                    long: long,
                    country: addressData.country,
                    states: addressData.states,
                    cities: addressData.cities,
                    nearbyPlaces: addressData.nearbyPlaces,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            catch (writeError) {
                console.error("Error writing to Firestore:", writeError);
                res.status(500).send("Error saving place to Firestore.");
                return;
            }
            res.status(200).json({ places: [addressData] });
        }
    }
    catch (error) {
        console.error("Error fetching places:", error);
        res.status(500).send("Error fetching places.");
    }
});
//# sourceMappingURL=index.js.map