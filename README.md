# Whatsapp-auto-message-sender

## Background sending via cronjob (new)

App ab do tarike se message bhej sakta hai:

1. **Manual (foreground)** — app khula rakho, "Start Sending" dabao. Duplicate numbers pe 24h se zyada purana ho to popup aayega (skip/resend), 24h ke andar ho to auto-skip.
2. **Background (Cron)** — "Queue for Background (Cron)" dabao. Isme koi popup nahi aata, jo bhi number pehle kabhi 'sent' status se bhej chuke ho wo seedha auto-skip ho jata hai. Ye queue tab tak nahi badhegi jab tak koi external cronjob website is URL ko hit na kare:

   ```
   https://<your-vercel-domain>/api/cron/send
   ```

   Cron-job.org (ya koi bhi similar service) pe ye URL daal do, jitni baar bhi chaho hit karao (har 30 sec, 1 min, jo bhi) — matter nahi karta. Actual message bhejne ka interval hamesha **fixed 2 minute** rahega, chahe cron URL kitni baar bhi hit ho. Agar interval poora nahi hua to endpoint bas `{ action: "waiting" }` return karke kuch nahi karega.

   Optional safety: Vercel env var `CRON_SECRET` set karo, phir URL is tarah hit karana hoga: `.../api/cron/send?key=YOUR_SECRET`.

3. **Mutex** — Manual aur Cron ek saath kabhi nahi chalenge. Jo bhi pehle start ho, doosra tab tak start nahi hoga jab tak pehla complete/stop na ho jaye. Agar background queue chal rahi ho to app khol ke uske live logs dekh sakte ho ("View Logs" button), aur chaho to "Stop Queue" se rok bhi sakte ho.
