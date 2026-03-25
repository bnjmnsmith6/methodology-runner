/**
 * Chat server
 * 
 * Express server with Claude API integration for orchestrator chat.
 */

import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { ORCHESTRATOR_SYSTEM_PROMPT } from './system-prompt.js';
import { ORCHESTRATOR_TOOLS, handleToolCall } from './tools.js';
import { getActiveIntake, handleIntakeReply } from '../intake/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOOL_ROUNDS = 5; // Prevent infinite loops

/**
 * Start the chat server
 */
export async function startChatServer(port: number = 3000): Promise<void> {
  const app = express();
  
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../../public')));
  
  // Chat endpoint
  app.post('/chat', async (req, res) => {
    try {
      const { message, conversationHistory = [] } = req.body;
      
      if (!message) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }
      
      console.log(`\n💬 User: ${message}`);
      
      // MIDDLEWARE: Check for active vision session BEFORE going to orchestrator
      // This prevents the orchestrator from calling start_vision on every message
      const activeSession = await getActiveIntake();
      if (activeSession.active && activeSession.sessionId) {
        console.log(`   🔄 Active vision session detected: ${activeSession.sessionId}`);
        console.log(`   ➡️  Bypassing orchestrator, calling continue_vision directly`);
        
        // Call handleIntakeReply directly (bypasses orchestrator)
        const intakeResponse = await handleIntakeReply(activeSession.sessionId, message);
        
        // Format the response as a markdown message
        let responseText = intakeResponse.message;
        
        if (intakeResponse.quickOptions && intakeResponse.quickOptions.length > 0) {
          responseText += '\n\n**Quick options:**\n' + intakeResponse.quickOptions.map(opt => `• ${opt}`).join('\n');
        }
        
        // Set up SSE (Server-Sent Events)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        // Stream the response
        res.write(`data: ${JSON.stringify({ type: 'text', content: responseText })}\n\n`);
        
        // Send done event with simplified message structure
        const doneMessage = {
          type: 'done',
          assistant_message: {
            role: 'assistant',
            content: [{ type: 'text', text: responseText }],
          },
        };
        res.write(`data: ${JSON.stringify(doneMessage)}\n\n`);
        res.end();
        
        console.log(`   ✅ Vision session response sent (type: ${intakeResponse.type})`);
        console.log(`   📊 Session complete: ${intakeResponse.visionSessionComplete}`);
        
        if (intakeResponse.visionSessionComplete) {
          console.log(`   🎉 Vision session completed! Ready for approval.`);
        }
        
        return;
      }
      
      // No active session - proceed with normal orchestrator flow
      console.log(`   ➡️  No active vision session, routing to orchestrator`);
      
      // Build messages array from history + new message
      let messages: Anthropic.MessageParam[] = [
        ...conversationHistory,
        { role: 'user', content: message },
      ];
      
      // Set up SSE (Server-Sent Events)
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      let fullResponse = '';
      let rounds = 0;
      
      // Multi-turn tool execution loop
      while (rounds < MAX_TOOL_ROUNDS) {
        rounds++;
        
        // Call Claude
        const response = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: ORCHESTRATOR_SYSTEM_PROMPT,
          tools: ORCHESTRATOR_TOOLS,
          messages,
        });
        
        // Handle text content
        for (const content of response.content) {
          if (content.type === 'text') {
            fullResponse += content.text;
            res.write(`data: ${JSON.stringify({ type: 'text', content: content.text })}\n\n`);
          }
        }
        
        // If Claude is done (not requesting tools), exit loop
        if (response.stop_reason === 'end_turn') {
          res.write(`data: ${JSON.stringify({ type: 'done', assistant_message: response })}\n\n`);
          break;
        }
        
        // If Claude wants to use tools, execute them
        if (response.stop_reason === 'tool_use') {
          const toolResults: Anthropic.MessageParam = {
            role: 'user',
            content: [],
          };
          
          // Execute all tool uses in this turn
          for (const content of response.content) {
            if (content.type === 'tool_use') {
              console.log(`\n🔧 Tool call: ${content.name}`);
              console.log(`   Input:`, JSON.stringify(content.input, null, 2));
              
              res.write(`data: ${JSON.stringify({ type: 'tool_use', name: content.name, input: content.input })}\n\n`);
              
              const result = await handleToolCall(content.name, content.input);
              console.log(`   Result:`, JSON.stringify(result, null, 2));
              
              (toolResults.content as any[]).push({
                type: 'tool_result',
                tool_use_id: content.id,
                content: JSON.stringify(result),
              });
              
              res.write(`data: ${JSON.stringify({ type: 'tool_result', name: content.name, result })}\n\n`);
            }
          }
          
          // Add assistant message and tool results to conversation
          messages.push(
            { role: 'assistant', content: response.content },
            toolResults
          );
          
          // Continue loop to get Claude's next response
          continue;
        }
        
        // If stop_reason is something else, exit
        break;
      }
      
      if (rounds >= MAX_TOOL_ROUNDS) {
        console.warn(`⚠️  Hit max tool rounds (${MAX_TOOL_ROUNDS})`);
        res.write(`data: ${JSON.stringify({ type: 'warning', message: 'Hit max tool execution rounds' })}\n\n`);
      }
      
      res.end();
      
      console.log(`\n🤖 Assistant: ${fullResponse}\n`);
      
    } catch (err) {
      console.error('Chat error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', worker: 'running' });
  });
  
  // Start server
  app.listen(port, () => {
    console.log(`\n✅ Chat server listening on http://localhost:${port}`);
    console.log(`   Open your browser to start chatting with the orchestrator\n`);
  });
}
