/**
 * ChatScreen.tsx — Agent chat interface.
 */

import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import httpClient from '../services/httpClient';
import Animated, { FadeInUp, FadeInDown, Layout } from 'react-native-reanimated';
import HapticFeedback from 'react-native-haptic-feedback';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { useTheme } from '../hooks/useTheme';
import { Send, Bot, User, MoreHorizontal } from '../constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';

type Message = {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
};

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export const ChatScreen = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'system', content: 'Hello! I am your SalesOps Agent. How can I assist you with leads today?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  
  const { colors, spacing, borderRadius } = useTheme();
  const user = useAppSelector((s) => s.auth.user);
  const initials = user?.name ? user.name.split(' ').map((s) => s[0]).join('').substring(0, 2).toUpperCase() : 'AA';

  const triggerHaptic = (type: 'impactLight' | 'notificationSuccess' | 'notificationError' | 'selection') => {
    HapticFeedback.trigger(type, hapticOptions);
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isTyping) return;

    triggerHaptic('impactLight');
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: inputText.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const backendMessages = [...messages, userMsg]
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      const response = await httpClient.post(
        '/chat/',
        { messages: backendMessages },
      );

      triggerHaptic('notificationSuccess');
      const agentMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'agent', 
        content: response.data.message 
      };
      setMessages(prev => [...prev, agentMsg]);
    } catch (error: any) {
      triggerHaptic('notificationError');
      console.error('Chat error:', error.response?.data || error.message);
      const errorMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'system', 
        content: 'Failed to reach agent. ' + (error.response?.data?.detail || error.message) 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const isSystem = item.role === 'system';

    return (
      <Animated.View 
        entering={isUser ? FadeInDown.springify().damping(12).stiffness(100) : FadeInUp.springify().damping(12).stiffness(100)}
        layout={Layout.springify().damping(14).stiffness(100)}
        style={[styles.messageWrapper, { alignSelf: isUser ? 'flex-end' : 'flex-start', flexDirection: isUser ? 'row-reverse' : 'row' }]}
      >
        {!isSystem && (
          <View style={[styles.avatar, { backgroundColor: isUser ? colors.primary : colors.surfaceHighlight, borderColor: colors.border }]}>
            {isUser ? <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>{initials}</Text> : <Bot size={16} color={colors.text} />}
          </View>
        )}
        <View 
          style={[
            styles.messageBubble,
            { borderRadius: borderRadius.lg },
            isUser ? { backgroundColor: colors.primary, borderTopRightRadius: 4 } : (isSystem ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border } : { backgroundColor: colors.surfaceHighlight, borderTopLeftRadius: 4 })
          ]}>
          <Text style={[
            styles.messageText,
            { color: isUser ? '#FFF' : colors.text },
            isSystem && { fontStyle: 'italic', color: colors.textMuted }
          ]}>
            {item.content}
          </Text>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderColor: colors.border, padding: spacing.md }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[styles.headerIconContainer, { backgroundColor: colors.primaryMuted }]}>
            <Bot size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>SalesOps Agent</Text>
            <Text style={[styles.headerSubtitle, { color: colors.success }]}>Online</Text>
          </View>
        </View>
        <TouchableOpacity>
          <MoreHorizontal size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={[styles.listContent, { padding: spacing.md, gap: spacing.md }]}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      />
      
      {isTyping && (
        <Animated.View entering={FadeInDown} style={[styles.typingIndicator, { paddingHorizontal: spacing.md }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.typingText, { color: colors.textMuted }]}>Agent is thinking...</Text>
        </Animated.View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border, padding: spacing.md, paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, borderRadius: borderRadius.xl, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }]}
            placeholder="Ask me anything..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendButton, { backgroundColor: !inputText.trim() ? colors.surfaceHighlight : colors.primary }]} 
            onPress={sendMessage}
            disabled={!inputText.trim() || isTyping}
          >
            <Send size={18} color={!inputText.trim() ? colors.textMuted : '#FFF'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
  headerIconContainer: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, fontWeight: '500' },
  listContent: { paddingBottom: 20 },
  messageWrapper: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '85%', marginVertical: 2 },
  avatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  messageBubble: { padding: 12, flexShrink: 1 },
  messageText: { fontSize: 15, lineHeight: 22 },
  typingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
  typingText: { fontSize: 13, fontStyle: 'italic' },
  inputContainer: { flexDirection: 'row', borderTopWidth: 1, alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, borderWidth: 1, fontSize: 15, maxHeight: 120, minHeight: 40 },
  sendButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', paddingLeft: 2 },
});
