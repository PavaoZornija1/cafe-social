import React, { useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, Animated } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/type';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const MENU_ITEMS = [
    'Profile',
    'Rewards',
    'Venue',
    'Leaderboard',
    'Settings',
    'Logout',
] as const;


export default function HomeScreen({ navigation, route }: Props) {
    const username = route.params.username;

    const scale = useRef(new Animated.Value(1)).current;
    const animateIn = () => {
        Animated.spring(scale, {
            toValue: 0.96,
            useNativeDriver: true,
            speed: 30,
            bounciness: 6,
        }).start();
    };
    const animateOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 24,
            bounciness: 8,
        }).start();
    };

    const handlePlay = () => {
        Alert.alert('Coming soon', 'Game entry will be connected next.');
    };
    const handleMenuPress = (item: (typeof MENU_ITEMS)[number]) => {
        if (item === 'Logout') {
            navigation.replace('Login');
            return;
        }
        Alert.alert('Coming soon', `${item} is not connected yet.`);
    };
    return (
        <View style={styles.screen}>
            <Text style={styles.welcome}>Welcome, {username}</Text>
            <View style={styles.centerArea}>
                <AnimatedPressable
                    onPress={handlePlay}
                    onPressIn={animateIn}
                    onPressOut={animateOut}
                    style={[
                        styles.playButton,
                        { transform: [{ scale }] },
                    ]}
                >
                    <Text style={styles.playText}>PLAY</Text>
                </AnimatedPressable>
            </View>
            <View style={styles.menu}>
                {MENU_ITEMS.map((item) => (
                    <Pressable
                        key={item}
                        onPress={() => handleMenuPress(item)}
                        style={({ pressed }) => [
                            styles.menuItem,
                            pressed && styles.menuItemPressed,
                            item === 'Logout' && styles.logoutItem,
                        ]}
                    >
                        <Text
                            style={[
                                styles.menuText,
                                item === 'Logout' && styles.logoutText,
                            ]}
                        >
                            {item}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#050816',
        paddingHorizontal: 24,
        paddingTop: 72,
        paddingBottom: 32,
    },
    welcome: {
        color: '#d4d4d8',
        fontSize: 18,
        textAlign: 'center',
    },
    centerArea: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playButton: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#7c3aed',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#7c3aed',
        shadowOpacity: 0.35,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
        transform: [{ scale: 1 }],
    },
    playButtonPressed: {
        opacity: 0.85,
        transform: [{ scale: 0.98 }],
    },
    playText: {
        color: '#ffffff',
        fontSize: 30,
        fontWeight: '800',
        letterSpacing: 1,
    },
    menu: {
        gap: 12,
    },
    menuItem: {
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#1f2937',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        alignItems: 'center',
    },
    menuItemPressed: {
        opacity: 0.85,
    },
    menuText: {
        color: '#f9fafb',
        fontSize: 16,
        fontWeight: '600',
    },
    logoutItem: {
        backgroundColor: '#1f172a',
        borderColor: '#3b1d52',
    },
    logoutText: {
        color: '#fca5a5',
    },
});