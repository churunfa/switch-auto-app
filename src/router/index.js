import { createRouter, createWebHistory } from 'vue-router';
import BaseOperate from '../views/BaseOperate.vue';
import TopologyConfig from '../views/topology/TopologyConfig.vue';
import ButtonBindingView from '../views/ButtonBindingView.vue';

const routes = [
    {
        path: '/',
        redirect: '/base'
    },
    {
        path: '/base',
        name: 'BaseOperate',
        component: BaseOperate,
        meta: { title: '基础操作按键面板' }
    },
    {
        path: '/topology',
        name: 'TopologyConfig',
        component: TopologyConfig,
        meta: { title: '组合按键拓扑图' }
    },
    {
        path: '/button-binding',
        name: 'ButtonBinding',
        component: ButtonBindingView,
        meta: { title: '按键绑定管理' }
    },
    // {
    //     path: '/yolo',
    //     name: 'Yolo',
    //     component: () => import('../views/EmptyPage.vue'), // 预留
    //     meta: { title: 'YOLO 自动执行' }
    // }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

export default router;