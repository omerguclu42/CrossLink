import sys

filepath = r"c:\Users\Ömer Faruk Güçlü\Desktop\CrossLink\operasyon.js"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_func = """    function parseRaporDate(dStr) {
        if (!dStr) return new Date(0);
        let parts = dStr.split(/[\\s.:\\/,-]/);
        if (parts.length >= 3) {
            let day = parseInt(parts[0], 10);
            let month = parseInt(parts[1], 10) - 1;
            let year = parseInt(parts[2], 10);
            if (year < 100) year += 2000;
            let d = new Date(year, month, day);
            if (isNaN(d.getTime())) return new Date(0);
            return d;
        }
        return new Date(0);
    }"""

new_func = """    function parseRaporDate(dStr) {
        if (!dStr) return new Date(0);
        let datePart = dStr;
        let timePart = "00:00:00";
        if (dStr.includes(" ")) {
            const split = dStr.split(" ");
            datePart = split[0];
            timePart = split[1] || "00:00:00";
        }
        let parts = datePart.split(/[\\s.:\\/,-]/);
        if (parts.length >= 3) {
            let day = parseInt(parts[0], 10);
            let month = parseInt(parts[1], 10) - 1;
            let year = parseInt(parts[2], 10);
            if (year < 100) year += 2000;
            let tParts = timePart.split(":");
            let hour = parseInt(tParts[0], 10) || 0;
            let min = parseInt(tParts[1], 10) || 0;
            let sec = parseInt(tParts[2], 10) || 0;
            let d = new Date(year, month, day, hour, min, sec);
            if (isNaN(d.getTime())) return new Date(0);
            return d;
        }
        return new Date(0);
    }"""

if old_func in content:
    content = content.replace(old_func, new_func)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced successfully (exact match).")
else:
    # try regex or loose match
    import re
    match = re.search(r'function parseRaporDate\(dStr\) \{.*?\n    \}', content, re.DOTALL)
    if match:
        content = content.replace(match.group(0), new_func)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Replaced successfully (regex match).")
    else:
        print("Failed to find parseRaporDate.")
