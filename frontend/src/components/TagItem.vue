<template>
  <li class="tag-item">
    <div class="tag-box" @click="navigateToDetail">
      <p>Tag 이름: {{ tagName }}</p> <!-- ✅ computed() 사용 -->
    </div>
    <ul v-if="tagChildren.length > 0" class="child-tags">
      <TagItem
          v-for="child in tagChildren"
          :key="child.id"
          :tag="child"
          @navigate="$emit('navigate', $event)"
      /> <!-- ✅ 부모로 이벤트 전달 -->
    </ul>
  </li>
</template>

<script setup>
import { computed, defineProps, defineEmits } from "vue";

// ✅ props 정의
const props = defineProps({
  tag: {
    type: Object,
    required: true,
  },
});

// ✅ 이벤트 정의
const emit = defineEmits(["navigate"]);

// ✅ computed() 사용하여 안전하게 데이터 접근
const tagName = computed(() => props.tag?.name ?? "이름 없음");
const tagChildren = computed(() => props.tag?.children ?? []);

// ✅ 클릭 시 상세 페이지로 이동
const navigateToDetail = () => {
  console.log("move tag detail, id = " + props.tag.id);
  emit("navigate", props.tag.id); // ✅ this 대신 emit 사용
};

console.log("✅ TagItem에서 받은 tag:", props.tag);
console.log("✅ TagItem에서 받은 tag.name:", tagName.value);
console.log("✅ TagItem에서 받은 tag.children:", tagChildren.value);
</script>


<!--<script setup>-->
<!--import { computed, defineProps } from "vue";-->

<!--const props = defineProps({-->
<!--  tag: {-->
<!--    type: Object,-->
<!--    required: true,-->
<!--  },-->
<!--});-->

<!--// ✅ `computed()`로 안전하게 데이터 접근-->
<!--const tagName = computed(() => props.tag?.name ?? "이름 없음");-->
<!--const tagChildren = computed(() => props.tag?.children ?? []);-->

<!--console.log("✅ TagItem에서 받은 tag:", props.tag);-->
<!--console.log("✅ TagItem에서 받은 tag.name:", tagName.value);-->
<!--console.log("✅ TagItem에서 받은 tag.children:", tagChildren.value);-->
<!--</script>-->

<!--<template>-->
<!--  <li class="tag-item">-->
<!--    <div class="tag-box">-->
<!--&lt;!&ndash;      <p>Tag 객체: {{ tag }}</p>&ndash;&gt;-->
<!--      <p>Tag 이름: {{ tagName }}</p> &lt;!&ndash; ✅ computed() 사용 &ndash;&gt;-->
<!--    </div>-->
<!--    <ul v-if="tagChildren.length > 0" class="child-tags">-->
<!--      <TagItem-->
<!--          v-for="child in tagChildren"-->
<!--          :key="child.id"-->
<!--          :tag="child"-->
<!--          @navigate="$emit('navigate', $event)"-->
<!--      />-->
<!--    </ul>-->
<!--  </li>-->
<!--</template>-->









<!--&lt;!&ndash;재귀적으로 태그를 렌더링&ndash;&gt;-->
<!--&lt;!&ndash;태그를 클릭 시 상세 페이지로 이동하는 역할&ndash;&gt;-->
<!--<template>-->
<!--&lt;!&ndash;  태그를 리스트 항목(<li>)으로 렌더링&ndash;&gt;-->
<!--  <li class="tag-item">-->
<!--    &lt;!&ndash; 클릭하면 상세 페이지로 이동, navigateToDetail() 실행 &ndash;&gt;-->
<!--    <div class="tag-box" @click="navigateToDetail">-->
<!--      <p>Tag 객체: {{ tag }}</p>-->
<!--      <p>Tag 이름: {{ name }}</p> &lt;!&ndash; ✅ name을 개별적으로 사용 &ndash;&gt;-->
<!--    </div>-->
<!--    &lt;!&ndash; 자식 태그 재귀적으로 렌더링, emit 문은 부모로 이벤트 전달 &ndash;&gt;-->
<!--    <ul v-if="children && children.length > 0" class="child-tags">-->
<!--      <TagItem-->
<!--          v-for="child in children"-->
<!--          :key="child.id"-->
<!--          :tag="child"-->
<!--          @navigate="$emit('navigate', $event)"-->
<!--      />-->
<!--    </ul>-->
<!--  </li>-->
<!--</template>-->

<!--<script>-->
<!--import { toRefs } from "vue";-->
<!--export default {-->
<!--  name: "TagItem",-->
<!--  // props로 tag 데이터 받음-->
<!--	// { id, name, children } 같은 트리 구조 데이터를 TagList.vue에서 전달받음-->
<!--  props: {-->
<!--    tag: {-->
<!--      type: Object,-->
<!--      required: true,-->
<!--    },-->
<!--  },-->

<!--  setup(props) {-->
<!--    // ✅ toRefs()를 사용하여 개별적인 반응형 변수로 변환-->
<!--    const { id, name, children } = toRefs(props);-->

<!--    const navigateToDetail = () => {-->
<!--      // TagList.vue에서 이를 받아서 라우팅하면 상세 페이지로 이동 가능-->
<!--      console.log("move tag detail, id = " + id.value);-->
<!--      this.$emit("navigate", this.tag.id);-->
<!--    };-->

<!--    return {-->
<!--      id,-->
<!--      name,-->
<!--      children,-->
<!--      navigateToDetail,-->
<!--    };-->
<!--  },-->
<!--  //-->
<!--  // methods: {-->
<!--  //   // TagList.vue에서 이를 받아서 라우팅하면 상세 페이지로 이동 가능-->
<!--  //   navigateToDetail() {-->
<!--  //     console.log("move tag detail, id = " + this.tag.id)-->
<!--  //     this.$emit("navigate", this.tag.id);-->
<!--  //   },-->
<!--  // },-->

<!--  mounted() {-->
<!--    console.log("✅ `TagItem.vue`에서 받은 tag 데이터:", this.tag); //	Proxy(Object) 형태로 보이면 tag가 반응형 객체로 감싸졌을 가능성이 있음-->
<!--    console.log("✅ TagItem에서 받은 tag.name:", this.tag.name); // undefined이면 tag 데이터가 올바르게 전달되지 않았을 가능성이 있음-->
<!--    console.log("✅ `TagItem.vue`에서 받은 children 데이터:", this.tag.children); // undefined이면 children 속성이 제대로 설정되지 않았을 가능성이 있음-->
<!--  },-->
<!--};-->
<!--</script>-->

<style>
.item {
  cursor: pointer;
  text-decoration: none;
  color: blue;
}
.item:hover {
  text-decoration: underline;
}
</style>