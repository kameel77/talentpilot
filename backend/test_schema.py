from schemas import TeamUpdate

data1 = TeamUpdate(name="test")
print("Only name:", data1.model_dump(exclude_unset=True))

data2 = TeamUpdate(manager_id=None)
print("Explicit manager_id=None:", data2.model_dump(exclude_unset=True))

data3 = TeamUpdate.model_validate({"manager_id": None})
print("Parsed manager_id=None:", data3.model_dump(exclude_unset=True))
