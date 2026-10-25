import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import TransactionsScreen from '../screens/TransactionsScreen';
import BudgetsScreen from '../screens/BudgetsScreen';
import ReportsScreen from '../screens/ReportsScreen';
import GoalsScreen from '../screens/GoalsScreen';
import AccountsScreen from '../screens/AccountsScreen';
import RecurringScreen from '../screens/RecurringScreen';
import MoreScreen from '../screens/MoreScreen';
import CurrencyScreen from '../screens/CurrencyScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MoreStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="MoreHome" component={MoreScreen} options={{ title: 'More' }} />
      <Stack.Screen name="Accounts" component={AccountsScreen} />
      <Stack.Screen name="Recurring" component={RecurringScreen} options={{ title: 'Recurring' }} />
      <Stack.Screen name="Currency" component={CurrencyScreen} options={{ title: 'Currency' }} />
    </Stack.Navigator>
  );
}

const icon = (name: React.ComponentProps<typeof Ionicons>['name']) =>
  ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size} />;

export default function AppTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Transactions" component={TransactionsScreen} options={{ tabBarIcon: icon('swap-horizontal-outline') }} />
      <Tab.Screen name="Budgets" component={BudgetsScreen} options={{ tabBarIcon: icon('pie-chart-outline') }} />
      <Tab.Screen name="Reports" component={ReportsScreen} options={{ tabBarIcon: icon('bar-chart-outline') }} />
      <Tab.Screen name="Goals" component={GoalsScreen} options={{ tabBarIcon: icon('flag-outline') }} />
      <Tab.Screen name="More" component={MoreStack} options={{ tabBarIcon: icon('ellipsis-horizontal') }} />
    </Tab.Navigator>
  );
}