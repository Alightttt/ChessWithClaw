#!/usr/bin/env python3
import os
import sys
import time
import json
import argparse
import threading
import urllib.request
import urllib.error

# Ensure work directories exist
os.makedirs("/tmp/cwc", exist_ok=True)

ERROR_LOG_PATH = "/tmp/cwc/errors.log"
STATE_PATH = "/tmp/cwc/state.json"
CHATS_PATH = "/tmp/cwc/chats.json"
STATUS_PATH = "/tmp/cwc/status.txt"
NEXT_MOVE_PATH = "/tmp/cwc/next_move.json"
NEXT_CHAT_PATH = "/tmp/cwc/next_chat.json"

def log_error(msg):
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    formatted = f"[{timestamp}] {msg}\n"
    sys.stderr.write(formatted)
    try:
        with open(ERROR_LOG_PATH, "a") as f:
            f.write(formatted)
    except Exception:
        pass

def log_info(msg):
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] INFO: {msg}")

def read_credentials():
    creds = {"game_id": "", "token": "", "name": "OpenClaw"}
    # Try Reading from arguments
    parser = argparse.ArgumentParser(description="ChessWithClaw Agent Connector")
    parser.add_argument("--game-id", help="Game UUID")
    parser.add_argument("--token", help="Agent Token")
    parser.add_argument("--name", help="Agent Name")
    args, unknown = parser.parse_known_args()

    if args.game_id:
        creds["game_id"] = args.game_id
    if args.token:
        creds["token"] = args.token
    if args.name:
        creds["name"] = args.name

    # Try Reading from /tmp/cwc/creds.env
    creds_file = "/tmp/cwc/creds.env"
    if os.path.exists(creds_file):
        try:
            with open(creds_file, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip().replace("export ", "")
                        v = v.strip().strip('"').strip("'")
                        if k in ["GAME_ID", "GAMEID"]:
                            creds["game_id"] = creds["game_id"] or v
                        elif k in ["AGENT_TOKEN", "TOKEN"]:
                            creds["token"] = creds["token"] or v
                        elif k in ["AGENT_NAME", "NAME"]:
                            creds["name"] = creds["name"] or v
        except Exception as e:
            log_error(f"Error reading creds.env: {e}")

    # Fallback to Environment Variables
    creds["game_id"] = creds["game_id"] or os.getenv("GAME_ID") or ""
    creds["token"] = creds["token"] or os.getenv("AGENT_TOKEN") or ""
    creds["name"] = creds["name"] or os.getenv("AGENT_NAME") or "OpenClaw"

    return creds

def make_request(url, method="GET", headers=None, payload=None):
    if headers is None:
        headers = {}
    headers["Content-Type"] = "application/json"
    
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.getcode(), json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_msg = ""
        try:
            err_msg = e.read().decode("utf-8")
        except Exception:
            pass
        log_error(f"HTTPError on {method} {url}: {e.code} - {err_msg}")
        return e.code, {"error": e.reason, "detail": err_msg}
    except Exception as e:
        log_error(f"Request Error on {method} {url}: {e}")
        return 500, {"error": str(e)}

def heartbeat_thread(base_url, game_id, agent_token):
    log_info("Starting Heartbeat background loop...")
    while True:
        url = f"{base_url}/api/heartbeat?gameId={game_id}"
        headers = {"x-agent-token": agent_token}
        code, resp = make_request(url, method="GET", headers=headers)
        if code != 200:
            log_error(f"Heartbeat pulse failed with status code {code}")
        time.sleep(15)

def send_greeting(base_url, game_id, agent_token, agent_name):
    # Check if a greeting was already delivered
    greeting_sent_file = "/tmp/cwc/greeting_sent.env"
    if os.path.exists(greeting_sent_file):
        return

    log_info(f"Sending greeting as '{agent_name}'...")
    url = f"{base_url}/api/chat"
    headers = {"x-agent-token": agent_token}
    payload = {
        "id": game_id,
        "sender": "agent",
        "text": f"Gutan Tag! I am {agent_name}, your Chess companion. Let's make this a legendary game! ♟️🦀",
        "role": "agent"
    }
    code, resp = make_request(url, method="POST", headers=headers, payload=payload)
    if code == 200:
        log_info("Greeting successfully broadcasted!")
        try:
            with open(greeting_sent_file, "w") as f:
                f.write("true")
        except Exception:
            pass
    else:
        log_error(f"Failed to send greeting: {resp}")

def main():
    creds = read_credentials()
    if not creds["game_id"] or not creds["token"]:
        log_error("CRITICAL: Missing GAME_ID or AGENT_TOKEN inside arguments, env variables, or /tmp/cwc/creds.env!")
        print("\nUsage example:")
        print("  python3 connect_agent.py --game-id <UUID> --token <TOKEN> --name <NAME>\n")
        sys.exit(1)

    # Automatically determine host url
    dev_url = os.getenv("DEVELOPMENT_URL") or os.getenv("APP_URL") or "http://localhost:3000"
    if dev_url.endswith("/"):
        dev_url = dev_url[:-1]

    log_info(f"Connecting to Game {creds['game_id']} at {dev_url} as {creds['name']}...")

    # Greet within 30 seconds requirement
    send_greeting(dev_url, creds["game_id"], creds["token"], creds["name"])

    # Launch background Heartbeat so agent stays "agent_connected: true"
    hb = threading.Thread(
        target=heartbeat_thread, 
        args=(dev_url, creds["game_id"], creds["token"]),
        daemon=True
    )
    hb.start()

    # Pre-fetch game state on launch to sync from /api/state as requested
    log_info("Fetching full initial game state...")
    state_url = f"{dev_url}/api/state?id={creds['game_id']}"
    code, state_resp = make_request(state_url, method="GET")
    if code == 200:
        with open(STATE_PATH, "w") as f:
            json.dump(state_resp, f, indent=2)
        log_info("Successfully synchronized initial state!")
    else:
        log_error(f"Initial state fetching failed: {state_resp}")

    last_move_count = 0
    last_chat_count = 0

    log_info("Starting long-polling interval...")
    while True:
        # Check if the agent wants to send an out-of-turn chat
        if os.path.exists(NEXT_CHAT_PATH):
            try:
                with open(NEXT_CHAT_PATH, "r") as f:
                    chat_data = json.load(f)
                chat_text = chat_data.get("text") or chat_data.get("message")
                if chat_text:
                    log_info(f"Sending chat from next_chat.json: {chat_text}")
                    headers = {"x-agent-token": creds["token"]}
                    payload = {
                        "id": creds["game_id"],
                        "sender": "agent",
                        "text": chat_text,
                        "role": "agent"
                    }
                    make_request(f"{dev_url}/api/chat", method="POST", headers=headers, payload=payload)
                os.remove(NEXT_CHAT_PATH)
            except Exception as e:
                log_error(f"Error sending manual chat message: {e}")

        # Poll the server
        poll_url = f"{dev_url}/api/poll?id={creds['game_id']}&last_move_count={last_move_count}&last_chat_count={last_chat_count}&agent_name={creds['name']}"
        headers = {"x-agent-token": creds["token"], "x-agent-name": creds["name"]}
        code, poll_resp = make_request(poll_url, method="GET", headers=headers)

        if code != 200:
            log_error(f"Polling endpoint error status {code}. Retrying...")
            time.sleep(5)
            continue

        # Save state & chats locally for the agent to inspect
        with open(STATE_PATH, "w") as f:
            json.dump(poll_resp, f, indent=2)

        chat_history = poll_resp.get("messages") or poll_resp.get("chat_history") or []
        with open(CHATS_PATH, "w") as f:
            json.dump(chat_history, f, indent=2)

        event = poll_resp.get("event")
        status = poll_resp.get("status")

        # Update poll counters
        last_move_count = poll_resp.get("move_count") or last_move_count
        last_chat_count = len(chat_history)

        # Handle Game Over / Abandonment Exit
        if event in ["game_ended", "abandoned", "finished"] or status in ["finished", "abandoned"]:
            log_info(f"Game finished! Event: '{event}', Status: '{status}', Result: {poll_resp.get('result')}")
            with open(STATUS_PATH, "w") as f:
                f.write(f"GAME_OVER: {status}")
            break

        # Handle Agent's Turn
        if event == "your_turn":
            log_info(f"It is YOUR TURN! Move number {poll_resp.get('move_number')}. FEN: {poll_resp.get('fen')}")
            with open(STATUS_PATH, "w") as f:
                f.write("YOUR_TURN")

            # Block and wait for next_move.json to be created
            log_info("Waiting for agent to write move to /tmp/cwc/next_move.json...")
            while True:
                if os.path.exists(NEXT_MOVE_PATH):
                    try:
                        time.sleep(0.1) # Small rest to ensure writing completed
                        with open(NEXT_MOVE_PATH, "r") as f:
                            move_payload = json.load(f)
                        
                        move_uci = move_payload.get("move")
                        # support thinking / reasoning / thought
                        reasoning = move_payload.get("reasoning") or move_payload.get("thinking") or move_payload.get("thought") or move_payload.get("text") or ""
                        
                        if move_uci:
                            log_info(f"Executing Chess Move: {move_uci} (Reason: {reasoning})")
                            headers = {"x-agent-token": creds["token"], "x-agent-name": creds["name"]}
                            move_url = f"{dev_url}/api/move"
                            payload = {
                                "id": creds["game_id"],
                                "move": move_uci,
                                "reasoning": reasoning,
                                "thinking": reasoning,
                                "thought": reasoning
                            }
                            
                            move_code, move_resp = make_request(move_url, method="POST", headers=headers, payload=payload)
                            if move_code == 200:
                                log_info("Move submitted successfully!")
                                os.remove(NEXT_MOVE_PATH)
                                with open(STATUS_PATH, "w") as fs_update:
                                    fs_update.write("WAITING_OPPONENT")
                                break
                            else:
                                log_error(f"Illegal or Rejected move draft: {move_resp}")
                                # Write error file to inform agent
                                with open("/tmp/cwc/move_error.json", "w") as fe:
                                    json.dump(move_resp, fe, indent=2)
                                os.remove(NEXT_MOVE_PATH)
                                break
                        else:
                            log_error("Invalid file content in next_move.json. Must contain a 'move' key.")
                            os.remove(NEXT_MOVE_PATH)
                            break
                    except Exception as e:
                        log_error(f"Error reading/parsing next_move.json: {e}")
                        if os.path.exists(NEXT_MOVE_PATH):
                            os.remove(NEXT_MOVE_PATH)
                        break
                
                # Sleep and wait in blocking loop for turn
                time.sleep(1)
        else:
            with open(STATUS_PATH, "w") as f:
                f.write("WAITING_OPPONENT")

        # Standard poll interval sleep
        time.sleep(3)

if __name__ == "__main__":
    main()
