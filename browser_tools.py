"""
Jarvis V2 — Browser Tools
Web search via DuckDuckGo Lite, page visits via Playwright, URL opening.
"""

import re
import sys
import webbrowser
import subprocess
from urllib.parse import unquote, parse_qs, urlparse
import httpx
from playwright.async_api import async_playwright

_browser = None
_context = None


def _bring_chromium_to_front():
    """Bring the Playwright Chromium window to the foreground on Windows."""
    # macOS: Playwright opens its window in front already
    if sys.platform != "win32":
        return
    try:
        subprocess.run([
            "powershell", "-Command",
            '(Get-Process -Name "chromium","chrome" -ErrorAction SilentlyContinue | '
            'Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -Last 1).MainWindowHandle | '
            'ForEach-Object { Add-Type "using System; using System.Runtime.InteropServices; '
            'public class W { [DllImport(\\\"user32.dll\\\")] public static extern bool SetForegroundWindow(IntPtr h); }"; '
            '[W]::SetForegroundWindow($_) }'
        ], capture_output=True, timeout=3)
    except Exception:
        pass


async def _get_browser():
    global _browser, _context
    if _browser is None:
        pw = await async_playwright().start()
        _browser = await pw.chromium.launch(headless=False, args=["--start-maximized"])
        _context = await _browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            no_viewport=True,
        )
    return _context


_READ_TEXT = """
    () => {
        const selectors = ['main', 'article', '[role="main"]', '.content', '#content', 'body'];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.innerText.trim().length > 100) {
                return el.innerText.trim();
            }
        }
        return document.body?.innerText?.trim() || '';
    }
"""

# Pages that answer with a block screen instead of content
_BLOCKED = re.compile(
    r"403 forbidden|access denied|just a moment|verify you are human|"
    r"enable javascript and cookies|request blocked|are you a robot",
    re.IGNORECASE,
)


def _looks_blocked(status, title: str, text: str) -> bool:
    if status is not None and status >= 400:
        return True
    if len(text) < 200:
        return True
    return bool(_BLOCKED.search(title) or _BLOCKED.search(text[:500]))


async def search_and_read(query: str, tries: int = 3) -> dict:
    """Search DuckDuckGo in visible browser and read the first result that isn't blocked."""
    ctx = await _get_browser()
    page = await ctx.new_page()
    try:
        # DuckDuckGo search (no cookie banner, no reCAPTCHA)
        search_url = f"https://duckduckgo.com/?q={query}"
        await page.goto(search_url, timeout=15000)
        _bring_chromium_to_front()
        await page.wait_for_timeout(2000)

        links = page.locator('[data-testid="result-title-a"]')
        hrefs = []
        for i in range(min(await links.count(), tries)):
            href = await links.nth(i).get_attribute("href")
            if href and href.startswith("http"):
                hrefs.append(href)
        if not hrefs:
            return {"error": "No results found.", "url": search_url}

        blocked = []
        for href in hrefs:
            try:
                resp = await page.goto(href, timeout=15000, wait_until="domcontentloaded")
                await page.wait_for_timeout(2000)
                title = await page.title()
                text = await page.evaluate(_READ_TEXT)
            except Exception:
                blocked.append(href)
                continue
            if _looks_blocked(resp.status if resp else None, title, text):
                blocked.append(href)
                continue
            return {"title": title, "url": page.url, "content": text[:3000]}

        return {"error": f"Every page I tried blocked me ({len(blocked)} sites).", "url": search_url}
    except Exception as e:
        return {"error": str(e), "url": query}


async def visit(url: str, max_chars: int = 5000) -> dict:
    """Visit a URL and extract main text content."""
    ctx = await _get_browser()
    page = await ctx.new_page()
    try:
        resp = await page.goto(url, timeout=15000, wait_until="domcontentloaded")
        text = await page.evaluate(_READ_TEXT)
        title = await page.title()
        if _looks_blocked(resp.status if resp else None, title, text):
            return {"error": "The site blocked me.", "url": url}
        return {"title": title, "url": url, "content": text[:max_chars]}
    except Exception as e:
        return {"error": str(e), "url": url}
    finally:
        await page.close()


async def fetch_news() -> str:
    """Fetch current world news from worldmonitor.app in visible browser."""
    ctx = await _get_browser()
    page = await ctx.new_page()
    try:
        await page.goto("https://www.worldmonitor.app/", timeout=20000)
        _bring_chromium_to_front()
        await page.wait_for_timeout(6000)  # Wait for JS to render
        text = await page.evaluate("() => document.body.innerText")
        # Extract the news sections
        content = text[:4000]
        return f"World Monitor news:\n{content}"
    except Exception as e:
        return f"News failed to load: {e}"
    finally:
        pass  # Keep page open so user can see it


async def open_url(url: str):
    """Open URL in user's default browser (non-blocking)."""
    import asyncio
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, webbrowser.open, url)
    return {"success": True, "url": url}


async def close():
    global _browser, _context
    if _browser:
        await _browser.close()
        _browser = None
        _context = None
