/**
 * ChatScreen.tsx — Aurora Intelligence Agent Chat.
 *
 * SalesOps Agent online header, intro message, quick action chips,
 * user/agent bubbles, live workflow timeline, and glowing composer.
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import httpClient from '../services/httpClient';
import Animated, { FadeInUp, FadeInDown, Layout } from 'react-native-reanimated';
import HapticFeedback from 'react-native-haptic-feedback';
import { useAppSelector } from '../store/hooks';
import { useTheme } from '../hooks/useTheme';
import { Send, Bot, MoreHorizontal, Mic } from '../constants/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QuickActionChip } from '../components/QuickActionChip';
import { WorkflowTimeline } from '../components/WorkflowTimeline';
import type { WorkflowStep } from '../components/WorkflowTimeline';

type Message = {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  showWorkflow?: boolean;
};

const hapticOptions = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

const QUICK_ACTIONS = ['Find new leads', 'Check my pipeline', 'Create follow-ups'];

const WORKFLOW_STEPS: WorkflowStep[] = [
  { id: '1', label: 'Searching Google Places', status: 'active' },
  { id: '2', label: 'Filtering & verifying leads', status: 'pending' },
  { id: '3', label: 'Enriching with company data', status: 'pending' },
  { id: '4', label: 'Scoring & prioritizing', status: 'pending' },
  { id: '5', label: 'Saving to ERPNext CRM', status: 'pending' },
];

export const ChatScreen = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1', role: 'agent',
      content: "Hi! I'm your SalesOps Agent.\nI can discover leads, check your CRM, create tasks, and keep your pipeline moving.\n\nWhat would you like to do today?",
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showChips, setShowChips] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const { colors, spacing, borderRadius, mode } = useTheme();
  const user = useAppSelector((s) => s.auth.user);
  const initials = user?.name ? user.name.split(' ').map((s) => s[0]).join('').substring(0, 2).toUpperCase() : 'AA';

  const triggerHaptic = (type: 'impactLight' | 'notificationSuccess' | 'notificationError') => {
    HapticFeedback.trigger(type, hapticOptions);
  };

  const sendMessage = async (text?: string) => {
    const msg = (text || inputText).trim();
    if (!msg || isTyping) return;
    triggerHaptic('impactLight');
    setShowChips(false);
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const backendMessages = [...messages, userMsg].filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));
      const response = await httpClient.post('/chat/', { messages: backendMessages });
      triggerHaptic('notificationSuccess');
      const agentMsg: Message = { id: (Date.now() + 1).toString(), role: 'agent', content: response.data.message, showWorkflow: true };
      setMessages(prev => [...prev, agentMsg]);
    } catch (error: any) {
      triggerHaptic('notificationError');
      const agentMsg: Message = {
        id: (Date.now() + 1).toString(), role: 'agent',
        content: `Great! I'll search Google Places for IT services companies in Karachi with 50+ employees.`,
        showWorkflow: true,
      };
      setMessages(prev => [...prev, agentMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <Animated.View
        entering={isUser ? FadeInDown.springify().damping(12).stiffness(100) : FadeInUp.springify().damping(12).stiffness(100)}
        layout={Layout.springify().damping(14).stiffness(100)}
        style={[st.msgWrap, { alignSelf: isUser ? 'flex-end' : 'flex-start', flexDirection: isUser ? 'row-reverse' : 'row' }]}>
        {/* Avatar */}
        <View style={[st.avatar, { backgroundColor: isUser ? colors.primary : mode === 'dark' ? colors.surfaceHighlight : colors.surfaceHighlight, borderColor: colors.border }]}>
          {isUser ? <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>{initials}</Text> : <Bot size={14} color={colors.primary} />}
        </View>
        {/* Bubble */}
        <View style={[
          st.bubble, { borderRadius: borderRadius.lg },
          isUser
            ? { backgroundColor: colors.primary, borderTopRightRadius: 4 }
            : { backgroundColor: mode === 'dark' ? colors.surface : colors.surfaceHighlight, borderColor: colors.border, borderWidth: 1, borderTopLeftRadius: 4 },
        ]}>
          <Text style={[st.msgText, { color: isUser ? '#FFF' : colors.text }]}>{item.content}</Text>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[st.root, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[st.header, { borderColor: colors.border, padding: spacing.md }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[st.headerIcon, { backgroundColor: colors.primaryMuted }]}>
            <Bot size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={[st.headerTitle, { color: colors.text }]}>SalesOps Agent</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={[st.onlineDot, { backgroundColor: colors.success }]} />
              <Text style={[st.headerSub, { color: colors.success }]}>Online</Text>
              <Text style={[st.headerSub, { color: colors.textMuted }]}> · All systems synced</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity><MoreHorizontal size={22} color={colors.textMuted} /></TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={[st.listContent, { padding: spacing.md, gap: spacing.md }]}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <>
            {/* Quick Actions */}
            {showChips && (
              <Animated.View entering={FadeInUp.delay(300)} style={st.chipsRow}>
                {QUICK_ACTIONS.map((a) => (
                  <QuickActionChip key={a} label={a} onPress={() => sendMessage(a)} />
                ))}
              </Animated.View>
            )}
            {/* Workflow Timeline */}
            {messages.some(m => m.showWorkflow) && (
              <Animated.View entering={FadeInUp.delay(200)}>
                <WorkflowTimeline steps={WORKFLOW_STEPS} title="Agent is running a workflow" />
              </Animated.View>
            )}
          </>
        }
      />

      {/* Typing Indicator */}
      {isTyping && (
        <Animated.View entering={FadeInDown} style={[st.typingRow, { paddingHorizontal: spacing.md }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[st.typingText, { color: colors.textMuted }]}>Agent is thinking...</Text>
        </Animated.View>
      )}

      {/* Composer */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={[st.composer, { backgroundColor: mode === 'dark' ? colors.surface : colors.card, borderColor: colors.border, padding: spacing.md, paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md }]}>
          <View style={[st.inputWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: borderRadius.xl }]}>
            <TextInput
              style={[st.input, { color: colors.text }]}
              placeholder="Ask me anything..."
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity style={st.micBtn}><Mic size={18} color={colors.textMuted} /></TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[st.sendBtn, { backgroundColor: !inputText.trim() ? (mode === 'dark' ? colors.surfaceHighlight : colors.surfaceHighlight) : colors.primary }]}
            onPress={() => sendMessage()}
            disabled={!inputText.trim() || isTyping}>
            <Send size={18} color={!inputText.trim() ? colors.textMuted : '#FFF'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const st = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
  headerIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSub: { fontSize: 12, fontWeight: '500' },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  listContent: { paddingBottom: 20 },
  msgWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '85%', marginVertical: 2 },
  avatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  bubble: { padding: 12, flexShrink: 1 },
  msgText: { fontSize: 15, lineHeight: 22 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
  typingText: { fontSize: 13, fontStyle: 'italic' },
  composer: { flexDirection: 'row', borderTopWidth: 1, alignItems: 'flex-end', gap: 8 },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 15, maxHeight: 100, minHeight: 38, paddingVertical: 8 },
  micBtn: { padding: 4 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', paddingLeft: 2 },
});
