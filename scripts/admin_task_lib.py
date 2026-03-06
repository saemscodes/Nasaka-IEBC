import os
import json
import requests
from datetime import datetime

class AdminTask:
    def __init__(self, task_id):
        self.task_id = task_id
        self.url = os.getenv('SUPABASE_URL')
        self.key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        self.headers = {
            'apikey': self.key,
            'Authorization': f'Bearer {self.key}',
            'Content-Type': 'application/json'
        }
        self.start_task()

    def start_task(self):
        """Update task status to running."""
        resp = requests.patch(
            f"{self.url}/rest/v1/admin_tasks?id=eq.{self.task_id}",
            headers=self.headers,
            json={'status': 'running', 'updated_at': datetime.utcnow().isoformat()}
        )
        resp.raise_for_status()

    def log(self, message, level='info', metadata=None):
        """Send a real-time log entry to Supabase."""
        print(f"[{level.upper()}] {message}")
        log_entry = {
            'task_id': self.task_id,
            'message': message,
            'level': level,
            'metadata': metadata or {},
            'timestamp': datetime.utcnow().isoformat()
        }
        resp = requests.post(
            f"{self.url}/rest/v1/admin_task_logs",
            headers=self.headers,
            json=log_entry
        )
        # We don't raise_for_status here to avoid crashing the whole task if logging fails once

    def propose_changes(self, changes):
        """Save proposed changes for human approval."""
        self.log(f"Proposing {len(changes)} changes for approval.", level='warn')
        resp = requests.patch(
            f"{self.url}/rest/v1/admin_tasks?id=eq.{self.task_id}",
            headers=self.headers,
            json={
                'status': 'awaiting_approval', 
                'proposed_changes': changes,
                'updated_at': datetime.utcnow().isoformat()
            }
        )
        resp.raise_for_status()

    def complete(self, summary="Task completed successfully."):
        """Mark task as completed."""
        self.log(summary, level='success')
        resp = requests.patch(
            f"{self.url}/rest/v1/admin_tasks?id=eq.{self.task_id}",
            headers=self.headers,
            json={
                'status': 'completed', 
                'completed_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            }
        )
        resp.raise_for_status()

    def fail(self, error_message):
        """Mark task as failed."""
        self.log(error_message, level='error')
        resp = requests.patch(
            f"{self.url}/rest/v1/admin_tasks?id=eq.{self.task_id}",
            headers=self.headers,
            json={
                'status': 'failed', 
                'error_message': error_message,
                'updated_at': datetime.utcnow().isoformat()
            }
        )
        resp.raise_for_status()
