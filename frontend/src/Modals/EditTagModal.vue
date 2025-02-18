<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <h2>태그 관리</h2>

      <!-- 태그 생성 -->
      <input v-model="newTagName" placeholder="새 태그 이름 입력" />
      <button @click="createTag">추가</button>

      <!-- 부모 태그 변경 -->
      <select v-model="selectedParentId">
        <option v-for="tag in flatTagList" :key="tag.id" :value="tag.id">
          {{ tag.indentation }}{{ tag.name }}
        </option>
      </select>
      <button @click="updateParentTag">부모 태그 변경</button>

      <!-- 태그 삭제 -->
      <button @click="deleteTag" class="delete-button">삭제</button>

      <button @click="closeModal">닫기</button>
    </div>
  </div>
</template>

<script setup>
import { ref, defineProps, watchEffect, computed } from "vue";
import axios from "axios";

const props = defineProps({
  isOpen: Boolean,
  tagData: Object,
});

const emit = defineEmits(["close"]);

const newTagName = ref("");
const selectedParentId = ref(null);
const tagList = ref([]);
const discardedTag = ref(null); // DISCARDED 태그 저장

console.log("tagData:", props.tagData);
console.log("memberId:", props.tagData?.memberId);
console.log("member:", props.tagData?.member);
console.log("member.id:", props.tagData?.member?.id);

// 태그 목록 불러오기
const fetchTags = async () => {
  try {
    console.log("fetch Tags memberId : " + props.tagData.memberId)
    const response = await axios.get(`/api/tag/${Number(props.tagData.memberId)}`);
    tagList.value = response.data;

    // DISCARDED 태그 설정
    discardedTag.value = tagList.value.find((tag) => tag.type === "DISCARDED") || null;

    console.log("tagList.value:", tagList.value); // ✅ 이 부분 추가
  } catch (error) {
    console.error("태그 목록 가져오기 실패", error);
  }
};

// 모달이 열릴 때 태그 목록 갱신
watchEffect(() => {
  if (props.isOpen) fetchTags();
});

// 태그 목록 평탄화 (계층 구조 유지)


const flatTagList = computed(() => {
  const flattenTags = (tags, depth = 0) => {
    const result = [];

    tags.forEach((tag) => {
      if (tag.type === "DISCARDED") {
        discardedTag.value = tag; // 단 하나의 DISCARDED 태그 저장
      } else {
        result.push({ ...tag, indentation: "— ".repeat(depth) }); // 들여쓰기 추가
        if (tag.children && tag.children.length > 0) {
          result.push(...flattenTags(tag.children, depth + 1));
        }
      }
    });
    return result;
  };

  return flattenTags(
      tagList.value.filter((tag) => tag.type !== "DISCARDED") // 최상위 DISCARDED 태그 제외
  );
});

// 태그 생성
const createTag = async () => {
  if (!newTagName.value) return alert("태그 이름을 입력하세요.");
  try {
    console.log("createTag memberId : " + props.tagData.memberId)
    console.log("currentTagId : " + props.tagData.Id)
    await axios.post(`/api/tag/${Number(props.tagData.id)}/create`, {
      tagName: newTagName.value,
      memberId: props.tagData.memberId,
      parentTagId: props.tagData.parentId,
    });
    alert("태그가 추가되었습니다.");
    newTagName.value = "";
    fetchTags(); // 굳이 한번 더 할 필요가 있으려나?
  } catch (error) {
    console.error("태그 생성 실패", error);
  }
};

// 부모 태그 변경
const updateParentTag = async () => {
  if (!selectedParentId.value) return alert("새 부모 태그를 선택하세요.");
  try {
    console.log("selectedParentId : " + selectedParentId.value)
    // props.tagData.id → props.tagData?.id 로 변경 후 처리 해줘야함 에러 방지 위해서
    await axios.put(`/api/tag/${Number(props.tagData.id)}/updateParent`, {
      newParentTagId: selectedParentId.value,
    });
    alert("부모 태그가 변경되었습니다.");
  } catch (error) {
    console.error("부모 태그 변경 실패", error);
  }
};

// 태그 삭제
const deleteTag = async () => {
  if (!confirm("정말 삭제하시겠습니까?")) return;
  try {
    await axios.put(`/api/tag/${Number(props.tagData.id)}/updateParent`, {
      newParentTagId: discardedTag.value.id,
    });
    alert("태그가 삭제되었습니다.");
  } catch (error) {
    console.error("태그 삭제 실패", error);
  }
};

// 모달 닫기
const closeModal = () => {
  emit("close");
};
</script>

<style>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}
.modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
}
.delete-button {
  background: red;
  color: white;
}
</style>
