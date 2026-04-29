import { createRouter, createWebHistory } from 'vue-router';
import BaseOperate from '../views/BaseOperate.vue';
import TopologyConfig from '../views/topology/TopologyConfig.vue';
import ButtonBindingView from '../views/ButtonBindingView.vue';
import SplatoonGraffiti from '../views/SplatoonGraffiti.vue';
import GeneralImageDraw from '../views/GeneralImageDraw.vue';

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
    {
        path: '/splatoon-graffiti',
        name: 'SplatoonGraffiti',
        component: SplatoonGraffiti,
        meta: { title: '斯普拉遁涂鸦' }
    },
    {
        path: '/general-image-draw',
        name: 'GeneralImageDraw',
        component: GeneralImageDraw,
        meta: { title: '通用图像绘制' }
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