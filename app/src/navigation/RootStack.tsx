import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { RootStackParamList } from "./type";
import LoginScreen from "../screens/LoginScreen";
import SignUpScreen from "../screens/SignUpScreen";
import HomeScreen from "../screens/HomeScreen";

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
            <Stack.Screen name="Home" component={HomeScreen} />
        </Stack.Navigator>
    );
}