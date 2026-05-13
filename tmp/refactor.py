import re

with open('src/pages/Game.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Make header 52px
code = code.replace("height: '64px'", "height: isDesktop ? '52px' : '64px'")

# Replace MAIN CONTENT SECTION
# We'll match from "{/* MAIN CONTENT SECTION */}" up to "{/* STATUS BAR */}"
match = re.search(r"(\s*\{/\* MAIN CONTENT SECTION \*/\}.*?)(?=\s*\{/\* STATUS BAR \*/\})", code, re.DOTALL)
if not match:
    print("Could not find MAIN CONTENT SECTION")
    exit(1)

original_main_content = match.group(1)

# Inside original_main_content, we need to extract:
# Agent Card
agent_card_match = re.search(r"(\s*\{/\* A\) AGENT CARD \*/\}.*?)(?=\s*\{/\* B\) CHESS BOARD \*/\})", original_main_content, re.DOTALL)
agent_card = agent_card_match.group(1)

# Chess Board
board_match = re.search(r"(\s*\{/\* B\) CHESS BOARD \*/\}.*?)(?=\s*\{/\* C\) YOU CARD \*/\})", original_main_content, re.DOTALL)
board = board_match.group(1)
board = board.replace("fen={game.fen}", "fen={optimisticFen || game.fen}")
board = board.replace("lastMove={(game.move_history || [])[(game.move_history || []).length - 1] || null}", "lastMove={optimisticLastMove || (game.move_history || [])[(game.move_history || []).length - 1] || null}")

# You Card
you_card_match = re.search(r"(\s*\{/\* C\) YOU CARD \*/\}.*?)(?=\s*\{/\* D\) CHAT SECTION \*/\})", original_main_content, re.DOTALL)
you_card = you_card_match.group(1)

# Chat Section
chat_match = re.search(r"(\s*\{/\* D\) CHAT SECTION \*/\}.*?)(?=\s*\{/\* E\) MOVE HISTORY \*/\})", original_main_content, re.DOTALL)
chat_section = chat_match.group(1)

# Move History
move_history_match = re.search(r"(\s*\{/\* E\) MOVE HISTORY \*/\}.*?)(?=\s*\{/\* STEP 4: BOTTOM INFO BAR \*/\})", original_main_content, re.DOTALL)
move_history = move_history_match.group(1)

# Bottom Info Bar
bottom_info_match = re.search(r"(\s*\{/\* STEP 4: BOTTOM INFO BAR \*/\}.*)", original_main_content, re.DOTALL)
bottom_info = bottom_info_match.group(1)


# Modify Agent Card for desktop:
desktop_agent_card = agent_card.replace("background: '#0e0e0e'", "background: isDesktop ? '#111111' : '#0e0e0e'")
desktop_agent_card = desktop_agent_card.replace("borderBottom: '1px solid #111'", "borderBottom: isDesktop ? 'none' : '1px solid #111', border: isDesktop ? '1px solid #1a1a1a' : 'none', borderRadius: isDesktop ? '12px' : '0'")
# Adjust Chat Section for desktop:
desktop_chat_section = chat_section.replace("background: '#0a0a0a'", "background: isDesktop ? '#111111' : '#0a0a0a', border: isDesktop ? '1px solid #1a1a1a' : 'none', borderRadius: isDesktop ? '12px' : '0', overflow: 'hidden'")
desktop_chat_section = desktop_chat_section.replace("height: '180px'", "height: isDesktop ? 'auto' : '180px', flex: isDesktop ? 1 : 'none'")
desktop_chat_section = desktop_chat_section.replace("borderTop: '1px solid #111111'", "borderTop: isDesktop ? 'none' : '1px solid #111111'")

# Modify Move History for desktop:
desktop_move_history = move_history.replace("background: '#0a0a0a'", "background: isDesktop ? '#111111' : '#0a0a0a', border: isDesktop ? '1px solid #1a1a1a' : 'none', borderRadius: isDesktop ? '12px' : '0', overflow: 'hidden'")

desktop_board = board.replace("padding: '12px'", "padding: isDesktop ? '0' : '12px', flex: isDesktop ? 1 : 'none', display: isDesktop ? 'flex' : 'block', alignItems: isDesktop ? 'center' : '', justifyContent: isDesktop ? 'center' : ''")
# Since we want the board to be centered in desktop, and width min(100%, ...), it's probably better to just wrap the inner ChessBoard call if isDesktop, but let's just rely on the flex styles.

desktop_bottom_info = bottom_info.replace("borderTop: '1px solid #1a1a1a'", "borderTop: isDesktop ? 'none' : '1px solid #1a1a1a', border: isDesktop ? '1px solid #1a1a1a' : 'none', borderRadius: isDesktop ? '8px' : '0'")

new_main_content = f'''
      {{/* MAIN CONTENT AREA - RESPONSIVE */}}
      {{isDesktop ? (
        <div style={{{{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 }}}}>
          {{/* LEFT DESKTOP COLUMN */}}
          <div style={{{{ width: '56%', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '12px 8px 12px 16px', gap: '8px' }}}}>
            {desktop_agent_card}
            <div style={{{{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}}}>
               <div style={{{{ width: 'min(100%, calc(100vh - 52px - 72px - 48px))', aspectRatio: '1 / 1', position: 'relative' }}}}>
                 {desktop_board}
               </div>
            </div>
            {desktop_bottom_info}
          </div>

          {{/* RIGHT DESKTOP COLUMN */}}
          <div style={{{{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 16px 12px 8px', gap: '8px', overflow: 'hidden', minHeight: 0 }}}}>
            {desktop_chat_section}
            {desktop_move_history}
          </div>
        </div>
      ) : (
        <>
          <div style={{{{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}}} className="scrollbar-none">
            {agent_card}
            {board}
            {you_card}
            {chat_section}
            {move_history}
          </div>
          {bottom_info}
        </>
      )}}
'''

code = code[:match.start()] + new_main_content + code[match.end():]

with open('src/pages/Game.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Game.jsx layout refactored.")
