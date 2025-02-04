<template>
  <div ref="treeContainer" class="tree-container"></div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import * as d3 from "d3";
import { useRouter, useRoute } from "vue-router";
import axios from "axios";

const treeContainer = ref(null); // 데이터를 저장할 변수
const router = useRouter();
const route = useRoute();
const memberId = route.params.id; // 🟢 URL에서 id 가져오기

let tagData = ref(null); // 태그 데이터 저장

d3.select("body").append("p").text("D3.js 테스트!"); // ✅ 정상 작동해야 함

// 🟢 서버에서 태그 데이터 가져오기
const fetchTags = async () => {
  try {
    // const id = Number(memberId);
    const response = await axios.get(`/api/tag/${Number(memberId)}`);
    console.log("서버에서 받은 태그 데이터:", response.data)
    tagData.value = response.data;
    // console.log("서버에서 받은 태그 데이터:", tagData.value)
    drawTree();
  } catch (error) {
    console.error("Error fetching tags:", error);
  }
};

// 🟢 마인드맵 트리 생성
const drawTree = () => {
  if (!tagData.value)
  {
    console.warn("트리를 그릴 데이터가 없음!");
    return;
  }

  console.log("🟢 트리 데이터 확인:", tagData.value);

  const width = 800;
  const height = 600;

  // 기존 SVG 제거 후 다시 그리기
  d3.select(treeContainer.value).selectAll("*").remove();

  // 🟢 SVG 생성 및 줌 기능 추가
  const svg = d3
      .select(treeContainer.value)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .call(
          d3.zoom().scaleExtent([0.5, 2]).on("zoom", (event) => {
            g.attr("transform", event.transform);
          })
      )
      .append("g");

  const root = d3.hierarchy(tagData.value);
  // console.log("🟢 D3 트리 구조 확인:", root);
  const treeLayout = d3.tree().size([height, width - 200]);
  treeLayout(root);

  const g = svg.append("g").attr("transform", `translate(${width / 2}, 50)`);

  // 🟢 링크 (선) 생성
  g.selectAll(".link")
      .data(root.links())
      .enter()
      .append("line")
      .attr("class", "link")
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y)
      .attr("stroke", "#ccc")
      .attr("stroke-width", 2);

  // 🟢 노드 (태그) 생성
  const nodes = g
      .selectAll(".node")
      .data(root.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`);

  // 🟢 원형 노드
  nodes
      .append("circle")
      .attr("r", 20)
      .attr("fill", "#007bff")
      .attr("cursor", "pointer")
      .on("click", (event, d) => {
        router.push(`/tag/${d.data.id}`);
      });

  // 🟢 텍스트 라벨 추가
  nodes
      .append("text")
      .attr("dy", -30)
      .attr("text-anchor", "middle")
      .text((d) => d.data.name)
      .attr("fill", "#333")
      .style("font-size", "14px");
};

// 🚀 컴포넌트 마운트 시 태그 데이터 가져오기
// onMounted(fetchTags);
onMounted(() => {
  console.log("✅ onMounted 실행됨!"); // ✅ 여기가 실행되는지 확인
  console.log("✅ treeContainer:", treeContainer.value); // ✅ 요소가 존재하는지 확인
  fetchTags();
});
</script>

<style>
.tree-container {
  width: 100%;
  height: 600px;
  overflow: hidden;
  background-color: #f8f9fa;
}
</style>
<!--<style src="@/assets/styles/mindmap.css"></style>-->