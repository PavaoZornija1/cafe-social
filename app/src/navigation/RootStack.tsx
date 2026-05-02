import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { RootStackParamList } from "./type";
import LoginScreen from "../screens/LoginScreen";
import SignUpScreen from "../screens/SignUpScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import HomeScreen from "../screens/HomeScreen";
import VenueHubScreen from "../screens/VenueHubScreen";
import DailyWordScreen from "../screens/DailyWordScreen";
import ChallengesScreen from "../screens/ChallengesScreen";
import LeaderboardScreen from "../screens/LeaderboardScreen";
import ProfileScreen from "../screens/ProfileScreen";
import FriendsScreen from "../screens/FriendsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import QrScanScreen from "../screens/QrScanScreen";
import WordLobbyScreen from "../screens/WordLobbyScreen";
import WordMatchJoinScreen from "../screens/WordMatchJoinScreen";
import WordMatchWaitScreen from "../screens/WordMatchWaitScreen";
import WordGameScreen from "../screens/WordGameScreen";
import PartiesScreen from "../screens/PartiesScreen";
import PartyDetailScreen from "../screens/PartyDetailScreen";
import RedeemInviteScreen from "../screens/RedeemInviteScreen";
import RedeemPerkScreen from "../screens/RedeemPerkScreen";
import RewardsHubScreen from "../screens/RewardsHubScreen";
import PeopleHereScreen from "../screens/PeopleHereScreen";
import ReportPlayerScreen from "../screens/ReportPlayerScreen";
import BanAppealScreen from "../screens/BanAppealScreen";
import MyVenueReportsScreen from "../screens/MyVenueReportsScreen";
import ChooseGameScreen from "../screens/ChooseGameScreen";
import BrawlerLobbyScreen from "../screens/BrawlerLobbyScreen";
import BrawlerArenaScreen from "../screens/BrawlerArenaScreen";
import StaffVenuesScreen from "../screens/StaffVenuesScreen";
import StaffRedemptionsScreen from "../screens/StaffRedemptionsScreen";
import StaffQrScanScreen from "../screens/StaffQrScanScreen";
import SubmitReceiptScreen from "../screens/SubmitReceiptScreen";
import PartnerVenuesMapScreen from "../screens/PartnerVenuesMapScreen";
import DiscoverHubScreen from "../screens/DiscoverHubScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStack() {
    return (
        <Stack.Navigator
            initialRouteName="Login"
            screenOptions={{
                headerShown: false,
                animation: "fade",
            }}
        >
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen
                name="Onboarding"
                component={OnboardingScreen}
                options={{ gestureEnabled: false }}
            />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="VenueHub" component={VenueHubScreen} />
            <Stack.Screen name="DiscoverHub" component={DiscoverHubScreen} />
            <Stack.Screen name="PartnerVenuesMap" component={PartnerVenuesMapScreen} />
            <Stack.Screen name="DailyWord" component={DailyWordScreen} />
            <Stack.Screen name="ChooseGame" component={ChooseGameScreen} />
            <Stack.Screen name="BrawlerLobby" component={BrawlerLobbyScreen} />
            <Stack.Screen name="BrawlerArena" component={BrawlerArenaScreen} />
            <Stack.Screen name="Challenges" component={ChallengesScreen} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Friends" component={FriendsScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Parties" component={PartiesScreen} />
            <Stack.Screen name="PartyDetail" component={PartyDetailScreen} />
            <Stack.Screen name="RedeemInvite" component={RedeemInviteScreen} />
            <Stack.Screen name="RedeemPerk" component={RedeemPerkScreen} />
            <Stack.Screen name="RewardsHub" component={RewardsHubScreen} />
            <Stack.Screen name="PeopleHere" component={PeopleHereScreen} />
            <Stack.Screen name="ReportPlayer" component={ReportPlayerScreen} />
            <Stack.Screen name="BanAppeal" component={BanAppealScreen} />
            <Stack.Screen name="MyVenueReports" component={MyVenueReportsScreen} />
            <Stack.Screen name="QrScan" component={QrScanScreen} />
            <Stack.Screen name="WordLobby" component={WordLobbyScreen} />
            <Stack.Screen name="WordMatchJoin" component={WordMatchJoinScreen} />
            <Stack.Screen name="WordMatchWait" component={WordMatchWaitScreen} />
            <Stack.Screen name="WordGame" component={WordGameScreen} />
            <Stack.Screen name="StaffVenues" component={StaffVenuesScreen} />
            <Stack.Screen name="StaffRedemptions" component={StaffRedemptionsScreen} />
            <Stack.Screen name="StaffQrScan" component={StaffQrScanScreen} />
            <Stack.Screen name="SubmitReceipt" component={SubmitReceiptScreen} />
        </Stack.Navigator>
    );
}