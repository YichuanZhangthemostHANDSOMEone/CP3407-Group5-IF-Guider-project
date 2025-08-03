import './styles.css';
import { auth, db } from '@modules/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
// @ts-ignore
import Chart from 'chart.js/auto';

type Metric = 'score' | 'accuracy' | 'time';
type AggMetric = 'attempts' | 'accuracy' | 'time';

document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn') as HTMLButtonElement;

    // 监听登录状态
    // @ts-ignore
    onAuthStateChanged(auth, async (user: User | null) => {
        if (!user) {
            location.href = '/login.html';
            return;
        }
        logoutBtn.onclick = async () => {
            await signOut(auth);
            location.href = '/login.html';
        };

        // 拉取 Firestore 中的 quizAttempts
        const snap = await getDocs(collection(db, 'users', user.uid, 'quizAttempts'));
        const data = snap.docs.map((d: { data: () => any; }) => d.data() as any);

        // 按 week 分组
        const byWeek: Record<number, any[]> = {};
        data.forEach((r: { week: any; }) => {
            const w = Number(r.week);
            byWeek[w] ??= [];
            byWeek[w].push(r);
        });

        const weeks = Array.from({ length: 10 }, (_, i) => i + 1);
        let selectedWeek = weeks[0];

        // 渲染 Week 按钮
        const weekTabs = document.getElementById('weekTabs')!;
        weeks.forEach((w, i) => {
            const btn = document.createElement('button');
            btn.textContent = `Week ${w}`;
            btn.classList.add('week-tab');
            btn.dataset.week = String(w);
            if (i === 0) btn.classList.add('active');
            weekTabs.appendChild(btn);
        });
        weekTabs.addEventListener('click', e => {
            const t = e.target as HTMLElement;
            if (!t.classList.contains('week-tab')) return;
            document.querySelectorAll('.week-tab').forEach(b => b.classList.remove('active'));
            t.classList.add('active');
            selectedWeek = Number(t.dataset.week);
            renderLine();
            renderAggregate();
            renderDistribution();
        });

        // 下拉菜单
        const weekMetricSelect = document.getElementById('weekMetricSelect') as HTMLSelectElement;
        const aggregateMetricSelect = document.getElementById('aggregateMetricSelect') as HTMLSelectElement;
        weekMetricSelect.addEventListener('change', renderLine);
        aggregateMetricSelect.addEventListener('change', renderAggregate);

        let lineChart: Chart, aggregateChart: Chart, distributionChart: Chart;

        // 折线图：单周各次尝试
        function renderLine() {
            const metric = weekMetricSelect.value as Metric;
            const arr = byWeek[selectedWeek] || [];

            // 计算卡片顶部显示
            let display = 0;
            if (metric === 'score') {
                display = arr.reduce((s, r) => s + (r.correctCnt || 0), 0);
            } else if (metric === 'accuracy') {
                // accuracy 小数转百分比
                display = arr.length
                    ? Math.round(arr.reduce((s, r) => s + ((r.accuracy ?? 0) * 100), 0) / arr.length)
                    : 0;
            } else {
                // time 字段用 totalTime
                display = arr.length
                    ? Math.round(arr.reduce((s, r) => s + (r.totalTime ?? 0), 0) / arr.length)
                    : 0;
            }
            document.getElementById('progressValue')!.textContent =
                metric === 'accuracy' ? `${display}%` : String(display);

            // 准备图表数据
            const labels = arr.map((_, i) => `Attempts${i + 1}`);
            const values = arr.map(r =>
                metric === 'score'
                    ? (r.correctCnt || 0)
                    : metric === 'accuracy'
                        ? ((r.accuracy ?? 0) * 100)
                        : (r.totalTime ?? 0)
            );

            const maxY = metric === 'accuracy'
                ? 100
                : values.length
                    ? Math.max(...values) * 1.1
                    : 10;

            lineChart?.destroy();
            lineChart = new Chart(
                document.getElementById('weekLineChart') as HTMLCanvasElement,
                {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [{
                            data: values,
                            fill: true,
                            borderColor: '#6366f1',
                            tension: 0.4
                        }]
                    },
                    options: {
                        scales: {
                            y: {
                                beginAtZero: true,
                                min: 0,
                                max: maxY
                            }
                        }
                    }
                }
            );
        }

        // 柱状图：周平均指标
        function renderAggregate() {
            const metric = aggregateMetricSelect.value as AggMetric;
            const arr = byWeek[selectedWeek] || [];

            // 卡片顶部显示
            let cardVal = 0;
            if (metric === 'attempts') {
                cardVal = arr.length;
            } else if (metric === 'accuracy') {
                cardVal = arr.length
                    ? Math.round(arr.reduce((s, r) => s + ((r.accuracy ?? 0) * 100), 0) / arr.length)
                    : 0;
            } else {
                cardVal = arr.length
                    ? Math.round(arr.reduce((s, r) => s + (r.totalTime ?? 0), 0) / arr.length)
                    : 0;
            }
            document.getElementById('tasksValue')!.textContent =
                metric === 'accuracy' ? `${cardVal}%` : String(cardVal);

            // 全周数据
            const labels = weeks.map(String);
            const values = weeks.map(w => {
                const a = byWeek[w] || [];
                if (metric === 'attempts') return a.length;
                if (metric === 'accuracy') {
                    return a.length
                        ? Math.round(a.reduce((s, r) => s + ((r.accuracy ?? 0) * 100), 0) / a.length)
                        : 0;
                }
                return a.length
                    ? Math.round(a.reduce((s, r) => s + (r.totalTime ?? 0), 0) / a.length)
                    : 0;
            });

            const maxY = metric === 'accuracy'
                ? 100
                : values.length
                    ? Math.max(...values) * 1.1
                    : 10;

            aggregateChart?.destroy();
            aggregateChart = new Chart(
                document.getElementById('aggregatedBarChart') as HTMLCanvasElement,
                {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [{ data: values, backgroundColor: '#c7d2fe' }]
                    },
                    options: {
                        scales: {
                            y: {
                                beginAtZero: true,
                                min: 0,
                                max: maxY
                            }
                        }
                    }
                }
            );
        }

        // 全宽分布柱状（Attempts Distribution）
        function renderDistribution() {
            const labels = weeks.map(String);
            const values = weeks.map(w => byWeek[w]?.length || 0);

            const maxY = values.length ? Math.max(...values) * 1.1 : 10;

            distributionChart?.destroy();
            distributionChart = new Chart(
                document.getElementById('bottomBarChart') as HTMLCanvasElement,
                {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [{ data: values, backgroundColor: '#e0e7ff' }]
                    },
                    options: {
                        scales: {
                            y: {
                                beginAtZero: true,
                                min: 0,
                                max: maxY
                            }
                        }
                    }
                }
            );
        }

        // 日历渲染（保持原样）
        function renderCalendar() {
            const cal = document.getElementById('calendar')!;
            const now = new Date(), y = now.getFullYear(), m = now.getMonth();
            const f = new Date(y, m, 1).getDay(), dim = new Date(y, m + 1, 0).getDate();
            let html = '<table class="calendar-table"><thead><tr>';
            ['Sun','Mon','Tue','Tur','Wed','Fri','Sat'].forEach(d => html += `<th>${d}</th>`);
            html += '</tr></thead><tbody><tr>';
            for (let i = 0; i < f; i++) html += '<td></td>';
            for (let d = 1; d <= dim; d++) {
                const isT = new Date(y, m, d).toDateString() === now.toDateString();
                html += `<td class="${isT?'today':''}">${d}</td>`;
                if ((f + d) % 7 === 0) html += '</tr><tr>';
            }
            html += '</tr></tbody></table>';
            cal.innerHTML = html;
        }

        // 初次渲染
        renderLine();
        renderAggregate();
        renderDistribution();
        renderCalendar();
    });
});