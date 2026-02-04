# Rex Healthify - Screen Designs

All screens follow Apple Human Interface Guidelines with Tamagui components.

## Design Principles

- **Color Palette**: Primary blue (#007AFF), destructive red (#EF4444), soft neutrals
- **Spacing**: Consistent $4–$6 between sections
- **Typography**: System fonts (SF Pro via Tamagui), large headings ($7–$9), readable body ($3–$4)
- **Elevation**: Subtle shadows and borders for depth
- **Accessibility**: SafeAreaView, VoiceOver labels, high contrast
- **Dark Mode**: Full support via Tamagui themes

## 1. Records Dashboard Screen

**Location**: `src/screens/Records/RecordsDashboardScreen.tsx`

### Features:
- **Header**: "My Records" title + "Add" button (primary blue)
- **Summary Cards**: 4-card grid showing Conditions, Medications (with progress), Allergies (red badges), Vaccinations
- **Tabs**: Timeline (default), Prescriptions, Labs/Reports
- **Timeline Tab**: Chronological list with type icons, doctor/hospital info, tap to detail
- **Prescriptions Tab**: Medication cards with checkboxes and compliance progress bars
- **Labs Tab**: Lab reports with key values highlighted
- **Floating Action**: "Scan Record" button (bottom-right, camera icon)

### Components Used:
- `Tabs` from Tamagui for tab navigation
- `Progress` for medication compliance
- `PillBadge` (custom XStack+Text) for tags
- `RecordCard` for timeline items
- `RNScrollView` for main scroll

## 2. Coach Chat Screen

**Location**: `src/screens/Coach/CoachChatScreen.tsx`

### Features:
- **Header**: "Health Coach" title + AI avatar + voice button
- **Proactive Banner**: Medication reminders or health insights (dismissible)
- **Chat Interface**: react-native-gifted-chat with custom Tamagui-styled bubbles
  - User messages: Right-aligned, blue background (#007AFF)
  - AI messages: Left-aligned, soft gray background (#F1F5F9)
- **Quick Suggestions**: Horizontal scrollable chips above input
- **Input Bar**: Text input + attach photo + voice + send button

### Components Used:
- `GiftedChat` from react-native-gifted-chat
- Custom `renderBubble`, `renderInputToolbar`, `renderSend`
- `RNScrollView` for quick suggestions
- `KeyboardAvoidingView` for iOS keyboard handling

## 3. Doctor Finder Screen

**Location**: `src/screens/Doctor/DoctorFinderScreen.tsx`

### Features:
- **Search Bar**: Large input with search button
- **Empty State**: Friendly illustration + instruction text
- **AI Recommendation Card**: Blue card with specialty recommendation + urgency badge
- **Doctor Cards**: Avatar, name, specialty badge, star rating, distance, availability, "Book" button
- **Refine Sheet**: Bottom sheet with specialty and distance filters

### Components Used:
- `Input` for search
- `Sheet` for refine filters
- `StarRating` component (custom)
- `DoctorCard` component (custom)

## 4. Profile Screen

**Location**: `src/screens/Profile/ProfileScreen.tsx`

### Features:
- **Profile Header**: Large avatar (editable) + name + edit button
- **Personal Info Card**: DOB, blood type, emergency contact (tap to edit)
- **QR Health Card Section**:
  - Emergency QR (red border, prominent)
  - Full Records QR (standard border)
  - Actions: View Full Size, Download, Regenerate (with warning dialog)
- **Accordion Sections**:
  - Active Medications: List with next dose countdown
  - Data & Privacy: Cloud sync toggle, export data, delete account
  - App Settings: Notifications toggle, dark mode toggle, language
- **Logout Button**: Outlined destructive style

### Components Used:
- `Avatar` from Tamagui
- `Accordion` for collapsible sections
- `Switch` for toggles
- `Dialog` for regenerate confirmation
- `QRDisplay` component

## Common Patterns

### Badge Replacement
Since Tamagui doesn't export `Badge`, all badges use:
```tsx
<XStack
  paddingHorizontal="$2"
  paddingVertical="$1"
  borderRadius="$4"
  backgroundColor="$blue4"
>
  <Text fontSize="$2" fontWeight="600" color="$blue11">
    Label
  </Text>
</XStack>
```

### Navigation
All screens use React Navigation hooks:
- `useNavigation<NavigationProp>()` for navigation
- Proper type safety with stack param lists

### Safe Areas
All screens wrap content in `SafeAreaView` from `react-native-safe-area-context`

### Scroll Views
Main content uses `RNScrollView` (React Native) instead of Tamagui's ScrollView for better compatibility

## Next Steps

1. **Connect Real Data**: Replace mock data with actual store/service calls
2. **Add Animations**: Subtle Tamagui animations on appear/interactions
3. **Error Handling**: Add error states and loading indicators
4. **Accessibility**: Add `accessibilityLabel` props to all interactive elements
5. **Testing**: Test on both iOS and Android devices

## Color Reference

- Primary: `$blue10` (#007AFF)
- Destructive: `$red9` (#EF4444)
- Success: `$green10` (#22C55E)
- Warning: `$yellow10` (#F59E0B)
- Background: `$background` (adapts to theme)
- Text: `$color` (adapts to theme)
- Muted Text: `$color10` (adapts to theme)
